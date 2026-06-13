const fs = require("node:fs");
const path = require("node:path");

const MAX_REASONABLE_DEPTH_M = 60;
const REGISTRY_MAX_DEPTH_MULTIPLIER = 1.5;
const SUPPORTED_GEOMETRY_TYPES = new Set([
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
  "Point",
  "MultiPoint"
]);

function parseDepth(value) {
  if (value === null || value === undefined) {
    return { kind: "missing" };
  }

  if (typeof value === "string" && value.trim() === "") {
    return { kind: "missing" };
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return { kind: "invalid" };
  }

  return { kind: "numeric", value: numericValue };
}

function validateDepthMap(root, depthMap) {
  const filename = path.join(root, depthMap.url);
  const geojson = JSON.parse(fs.readFileSync(filename, "utf8"));

  if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error(`${depthMap.id}: ${depthMap.url} must be a FeatureCollection`);
  }

  const geometryTypes = {};
  const propertyKeys = new Set();
  const numericDepths = [];
  let nullDepthCount = 0;
  let invalidDepthCount = 0;
  let suspiciousDepthCount = 0;

  geojson.features.forEach((feature) => {
    const geometryType = feature?.geometry?.type || "missing";
    geometryTypes[geometryType] = (geometryTypes[geometryType] || 0) + 1;

    const properties = feature?.properties || {};
    Object.keys(properties).forEach((key) => propertyKeys.add(key));

    const parsedDepth = parseDepth(properties[depthMap.depthProperty]);
    if (parsedDepth.kind === "missing") {
      nullDepthCount += 1;
      return;
    }
    if (parsedDepth.kind === "invalid") {
      invalidDepthCount += 1;
      suspiciousDepthCount += 1;
      return;
    }

    const absoluteDepth = Math.abs(parsedDepth.value);
    numericDepths.push(parsedDepth.value);
    const exceedsSafetyGuard = absoluteDepth > MAX_REASONABLE_DEPTH_M;
    const exceedsRegistryMaximum = Number.isFinite(depthMap.maxDepth)
      && absoluteDepth > depthMap.maxDepth * REGISTRY_MAX_DEPTH_MULTIPLIER;
    if (exceedsSafetyGuard || exceedsRegistryMaximum) {
      suspiciousDepthCount += 1;
    }
  });

  const absoluteDepths = numericDepths.map(Math.abs);
  const unsupportedGeometryTypes = Object.keys(geometryTypes)
    .filter((geometryType) => !SUPPORTED_GEOMETRY_TYPES.has(geometryType))
    .sort();
  let status = "ok";
  if (numericDepths.length === 0) {
    status = "no_numeric_depth";
  }
  if (suspiciousDepthCount > 0 || unsupportedGeometryTypes.length > 0) {
    status = "needs_review";
  }

  return {
    id: depthMap.id,
    waterBodyId: depthMap.waterBodyId,
    featureCount: geojson.features.length,
    geometryTypes,
    unsupportedGeometryTypes,
    propertyKeys: [...propertyKeys].sort(),
    depthProperty: depthMap.depthProperty,
    numericDepthCount: numericDepths.length,
    nullDepthCount,
    invalidDepthCount,
    minDepth: numericDepths.length ? Math.min(...numericDepths) : null,
    maxDepth: numericDepths.length ? Math.max(...numericDepths) : null,
    minAbsDepth: absoluteDepths.length ? Math.min(...absoluteDepths) : null,
    maxAbsDepth: absoluteDepths.length ? Math.max(...absoluteDepths) : null,
    suspiciousDepthCount,
    status
  };
}

function validateAvailableDepthMaps(root, registry) {
  return Array.from(
    registry.getAvailable(),
    (depthMap) => validateDepthMap(root, depthMap)
  );
}

module.exports = {
  MAX_REASONABLE_DEPTH_M,
  REGISTRY_MAX_DEPTH_MULTIPLIER,
  SUPPORTED_GEOMETRY_TYPES,
  parseDepth,
  validateDepthMap,
  validateAvailableDepthMaps
};
