(function initKlevbyDepthFeatureClassifier(global) {
  const SHALLOW_MAX_RATIO = 0.25;
  const DEEP_MIN_RATIO = 0.55;
  const VERY_DEEP_MIN_RATIO = 0.78;
  const MAX_REASONABLE_DEPTH_M = 60;
  const CANDIDATE_GEOMETRY_TYPES = Object.freeze(["Point", "Polygon"]);

  function parseDepthMeters(value) {
    if (value === null || value === undefined) return { kind: "missing" };
    if (typeof value === "string" && !value.trim()) return { kind: "missing" };

    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue)
      ? { kind: "numeric", value: numericValue }
      : { kind: "invalid" };
  }

  function getDepthFeatureValue(feature, depthProperty) {
    const propertyName = typeof depthProperty === "string" && depthProperty.trim()
      ? depthProperty
      : "depth_m";
    return parseDepthMeters(feature?.properties?.[propertyName]);
  }

  function getDepthStats(featureCollection, depthProperty) {
    const features = Array.isArray(featureCollection?.features)
      ? featureCollection.features
      : [];
    const geometryTypes = {};
    let numericDepthCount = 0;
    let missingDepthCount = 0;
    let invalidDepthCount = 0;
    let minDepth = null;
    let maxDepth = null;
    let maxAbsDepth = null;

    features.forEach(function (feature) {
      const geometryType = feature?.geometry?.type || "Missing";
      geometryTypes[geometryType] = (geometryTypes[geometryType] || 0) + 1;

      const parsedDepth = getDepthFeatureValue(feature, depthProperty);
      if (parsedDepth.kind === "missing") {
        missingDepthCount += 1;
        return;
      }
      if (parsedDepth.kind === "invalid") {
        invalidDepthCount += 1;
        return;
      }

      const depth = parsedDepth.value;
      const absoluteDepth = Math.abs(depth);
      numericDepthCount += 1;
      minDepth = minDepth === null ? depth : Math.min(minDepth, depth);
      maxDepth = maxDepth === null ? depth : Math.max(maxDepth, depth);
      maxAbsDepth = maxAbsDepth === null ? absoluteDepth : Math.max(maxAbsDepth, absoluteDepth);
    });

    return {
      featureCount: features.length,
      numericDepthCount,
      missingDepthCount,
      invalidDepthCount,
      minDepth,
      maxDepth,
      maxAbsDepth,
      geometryTypes
    };
  }

  function getDepthThresholds(depthMap, stats) {
    if (depthMap?.validationStatus !== "ok") {
      return {
        classificationEnabled: false,
        reason: "validation_status_not_ok"
      };
    }

    const registryMaxDepth = Number(depthMap?.maxDepth);
    const statsMaxAbsDepth = Number(stats?.maxAbsDepth);
    let effectiveMaxDepth = null;
    let effectiveMaxDepthSource = null;

    if (Number.isFinite(registryMaxDepth) && registryMaxDepth > 0) {
      effectiveMaxDepth = registryMaxDepth;
      effectiveMaxDepthSource = "registry";
    } else if (
      Number.isFinite(statsMaxAbsDepth)
      && statsMaxAbsDepth > 0
      && statsMaxAbsDepth <= MAX_REASONABLE_DEPTH_M
    ) {
      effectiveMaxDepth = statsMaxAbsDepth;
      effectiveMaxDepthSource = "stats";
    }

    if (effectiveMaxDepth === null) {
      return {
        classificationEnabled: false,
        reason: "no_reasonable_max_depth"
      };
    }

    return {
      classificationEnabled: true,
      effectiveMaxDepth,
      effectiveMaxDepthSource,
      shallowMaxDepth: effectiveMaxDepth * SHALLOW_MAX_RATIO,
      deepMinDepth: effectiveMaxDepth * DEEP_MIN_RATIO,
      veryDeepMinDepth: effectiveMaxDepth * VERY_DEEP_MIN_RATIO
    };
  }

  function classifyDepthValue(depthMetersAbs, thresholds) {
    if (!thresholds?.classificationEnabled) return null;

    const parsedDepth = parseDepthMeters(depthMetersAbs);
    if (parsedDepth.kind !== "numeric") return null;

    const absoluteDepth = Math.abs(parsedDepth.value);
    if (absoluteDepth <= thresholds.shallowMaxDepth) return "shallow";
    if (absoluteDepth < thresholds.deepMinDepth) return "mid";
    if (absoluteDepth < thresholds.veryDeepMinDepth) return "deep";
    return "very_deep";
  }

  function classifyDepthFeature(feature, depthMap, thresholds) {
    if (!thresholds?.classificationEnabled || depthMap?.validationStatus !== "ok") {
      return {
        classificationEnabled: false,
        band: null,
        pitCandidate: false,
        shoalCandidate: false
      };
    }

    const parsedDepth = getDepthFeatureValue(feature, depthMap?.depthProperty);
    if (parsedDepth.kind !== "numeric") {
      return {
        classificationEnabled: true,
        band: null,
        pitCandidate: false,
        shoalCandidate: false,
        depthKind: parsedDepth.kind
      };
    }

    const depthMetersAbs = Math.abs(parsedDepth.value);
    const band = classifyDepthValue(depthMetersAbs, thresholds);
    const geometryType = feature?.geometry?.type || null;
    const candidateGeometry = CANDIDATE_GEOMETRY_TYPES.includes(geometryType);

    return {
      classificationEnabled: true,
      depthMeters: parsedDepth.value,
      depthMetersAbs,
      geometryType,
      band,
      pitCandidate: candidateGeometry && band === "very_deep",
      shoalCandidate: candidateGeometry && band === "shallow"
    };
  }

  function analyzeDepthFeatureCollection(featureCollection, depthMap) {
    const stats = getDepthStats(featureCollection, depthMap?.depthProperty);
    const thresholds = getDepthThresholds(depthMap, stats);
    const bandCounts = {
      shallow: 0,
      mid: 0,
      deep: 0,
      very_deep: 0
    };
    const candidateCounts = {
      pit_candidate: 0,
      shoal_candidate: 0
    };

    if (!thresholds.classificationEnabled) {
      return {
        mapId: depthMap?.id || null,
        classificationEnabled: false,
        reason: thresholds.reason,
        stats,
        thresholds,
        bandCounts,
        candidateCounts
      };
    }

    const features = Array.isArray(featureCollection?.features)
      ? featureCollection.features
      : [];
    features.forEach(function (feature) {
      const classification = classifyDepthFeature(feature, depthMap, thresholds);
      if (classification.band) bandCounts[classification.band] += 1;
      if (classification.pitCandidate) candidateCounts.pit_candidate += 1;
      if (classification.shoalCandidate) candidateCounts.shoal_candidate += 1;
    });

    return {
      mapId: depthMap?.id || null,
      classificationEnabled: true,
      reason: null,
      stats,
      thresholds,
      bandCounts,
      candidateCounts
    };
  }

  global.KlevbyDepthFeatureClassifier = Object.freeze({
    SHALLOW_MAX_RATIO,
    DEEP_MIN_RATIO,
    VERY_DEEP_MIN_RATIO,
    MAX_REASONABLE_DEPTH_M,
    CANDIDATE_GEOMETRY_TYPES,
    parseDepthMeters,
    getDepthFeatureValue,
    getDepthStats,
    getDepthThresholds,
    classifyDepthValue,
    classifyDepthFeature,
    analyzeDepthFeatureCollection
  });
})(window);
