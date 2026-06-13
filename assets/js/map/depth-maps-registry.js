(function initKlevbyDepthMapsRegistry(global) {
  /**
   * Registry entries keep the current flat shape. Future entries may also use:
   * waterBodyId, shortName, type, region, district, status, format, source,
   * sourceUrl, license, attribution, minDepth, updatedAt, depthProperty,
   * depthSign, and version.
   */
  const maps = Object.freeze([
    Object.freeze({
      id: "zvon",
      name: "Звонь",
      url: "assets/data/depth-contours/zvon.depth.full.geojson",
      center: Object.freeze([28.531199724, 55.064883085]),
      bbox: Object.freeze([28.516146219, 55.057452077, 28.546253228, 55.072314093]),
      featureCount: 388,
      maxDepth: 18
    }),
    Object.freeze({
      id: "necherdo",
      name: "Нещердо",
      url: "assets/data/depth-contours/necherdo.depth.full.geojson",
      center: Object.freeze([29.080393061, 55.906274371]),
      bbox: Object.freeze([29.026201511, 55.852096276, 29.134584611, 55.960452465]),
      featureCount: 1348,
      maxDepth: 8.5
    }),
    Object.freeze({
      id: "valkovskoe",
      name: "Вальковское",
      url: "assets/data/depth-contours/valkovskoe.depth.full.geojson",
      center: Object.freeze([28.719792443, 55.983777037]),
      bbox: Object.freeze([28.702666184, 55.966973329, 28.736918702, 56.000580745]),
      featureCount: 1047
    }),
    Object.freeze({
      id: "yanovo",
      name: "Яново",
      url: "assets/data/depth-contours/yanovo.depth.full.geojson",
      center: Object.freeze([28.819236749, 55.277284638]),
      bbox: Object.freeze([28.771214546, 55.259325991, 28.867258951, 55.295243285]),
      featureCount: 623,
      maxDepth: 13
    }),
    Object.freeze({
      id: "leshno",
      name: "Лешно",
      url: "assets/data/depth-contours/leshno.depth.full.geojson",
      center: Object.freeze([29.255579680, 55.598471895]),
      bbox: Object.freeze([29.245291370, 55.593720224, 29.265867991, 55.603223567]),
      featureCount: 35
    }),
    Object.freeze({
      id: "lugovoe",
      name: "Луговое",
      url: "assets/data/depth-contours/lugovoe.depth.full.geojson",
      center: Object.freeze([29.967080875, 55.453690057]),
      bbox: Object.freeze([29.959083083, 55.450457991, 29.975078668, 55.456922123]),
      featureCount: 103
    }),
    Object.freeze({
      id: "obkomovskoe",
      name: "Обкомовское",
      url: "assets/data/depth-contours/obkomovskoe.depth.full.geojson",
      center: Object.freeze([31.037200013, 52.441768444]),
      bbox: Object.freeze([31.030024146, 52.439642090, 31.044375881, 52.443894799]),
      featureCount: 678
    }),
    Object.freeze({
      id: "paulyskoe",
      name: "Паульское",
      url: "assets/data/depth-contours/paulyskoe.depth.full.geojson",
      center: Object.freeze([28.915159180, 55.241522503]),
      bbox: Object.freeze([28.881858884, 55.216754073, 28.948459476, 55.266290934]),
      featureCount: 334
    }),
    Object.freeze({
      id: "stradechskoe",
      name: "Страдечское",
      url: "assets/data/depth-contours/stradechskoe.depth.full.geojson",
      center: Object.freeze([23.745543765, 51.880476607]),
      bbox: Object.freeze([23.742830281, 51.877809626, 23.748257249, 51.883143588]),
      featureCount: 51
    })
  ]);

  function normalizeId(value) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim().toLowerCase()
      : "";
  }

  function getAll() {
    return maps;
  }

  function getAvailable() {
    return maps.filter(function (depthMap) {
      return depthMap.status !== "disabled";
    });
  }

  function getById(id) {
    const normalizedId = normalizeId(id);
    if (!normalizedId) return null;
    return maps.find(function (depthMap) {
      return normalizeId(depthMap.id) === normalizedId;
    }) || null;
  }

  function getByWaterBodyId(waterBodyId) {
    const normalizedWaterBodyId = normalizeId(waterBodyId);
    if (!normalizedWaterBodyId) return null;
    return maps.find(function (depthMap) {
      return normalizeId(depthMap.waterBodyId || depthMap.id) === normalizedWaterBodyId;
    }) || null;
  }

  function hasAvailableDepthMap(waterBodyId) {
    const depthMap = getByWaterBodyId(waterBodyId);
    return Boolean(depthMap && depthMap.status !== "disabled");
  }

  global.KlevbyDepthMapsRegistry = Object.freeze({
    maps,
    getAll,
    getAvailable,
    getById,
    getByWaterBodyId,
    hasAvailableDepthMap
  });
})(window);
