(function initKlevbyWaterDepthSources(global) {
  const TABLE_NAME = "water_depth_sources";
  const AVAILABLE_DEPTH_MAP_STATUS = "найдено";
  const SELECT_COLUMNS = [
    "id",
    "name",
    "water_type",
    "region",
    "district",
    "latitude",
    "longitude",
    "location_quality",
    "location_source",
    "location_checked_at",
    "has_depth_map",
    "source",
    "source_url",
    "usage_rule",
    "quality",
    "comment",
    "checked_at",
    "created_at",
    "updated_at"
  ].join(",");
  const QUALITY_PRIORITY = new Map([
    ["точное совпадение", 0],
    ["похоже", 1]
  ]);
  const nameCollator = new Intl.Collator("ru", {
    sensitivity: "base"
  });

  function getSupabaseClient() {
    return (
      global.klevbySupabase ||
      global.supabaseClient ||
      (typeof global.klevbyGetSupabase === "function" ? global.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getQualityPriority(quality) {
    const normalizedQuality = String(quality || "").trim().toLowerCase();
    return QUALITY_PRIORITY.get(normalizedQuality) ?? 2;
  }

  function sortWaterDepthSources(rows) {
    return rows.slice().sort(function compareSources(left, right) {
      const priorityDifference = getQualityPriority(left?.quality) - getQualityPriority(right?.quality);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return nameCollator.compare(String(left?.name || ""), String(right?.name || ""));
    });
  }

  function isDebugEnabled() {
    if (global.KLEVB_WATER_DEPTH_DEBUG === true) {
      return true;
    }

    try {
      return global.localStorage?.getItem("KLEVB_WATER_DEPTH_DEBUG") === "1";
    } catch (_) {
      return false;
    }
  }

  async function fetchWaterDepthSources() {
    const supabase = getSupabaseClient();

    if (!supabase || typeof supabase.from !== "function") {
      console.warn("Klevby water depth sources: Supabase client is not available.");
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(SELECT_COLUMNS)
        .eq("has_depth_map", AVAILABLE_DEPTH_MAP_STATUS)
        .order("name", { ascending: true });

      if (error) {
        console.warn("Klevby water depth sources: fetch failed.", error);
        return [];
      }

      const sources = sortWaterDepthSources(Array.isArray(data) ? data : []);

      if (isDebugEnabled()) {
        console.info(`Klevby water depth sources: loaded ${sources.length} rows.`);
      }

      return sources;
    } catch (error) {
      console.warn("Klevby water depth sources: fetch failed.", error);
      return [];
    }
  }

  global.KlevbyWaterDepthSources = {
    fetchWaterDepthSources
  };
})(window);
