(function () {
  "use strict";

  const TYPE_VALUES = new Set(["all", "looking", "offering"]);
  const SHELF_VALUES = new Set(["active", "archive"]);
  const LOWER_FILTER_KEYS = new Set(["region", "date", "kind", "conditions"]);
  const listeners = new Set();
  const state = {
    selectedType: "all",
    selectedRegion: "all",
    selectedDateMode: "any",
    selectedFishingType: "any",
    selectedConditions: "any",
    activeLowerFilter: null,
    selectedShelf: "active",
    counts: {
      activeCount: 0,
      archiveCount: 0
    }
  };

  function snapshot() {
    return {
      ...state,
      counts: { ...state.counts }
    };
  }

  function notify(reason = "state") {
    const next = snapshot();
    listeners.forEach((listener) => listener(next, reason));
  }

  function setValue(key, value) {
    if (state[key] === value) return snapshot();
    state[key] = value;
    notify(key);
    return snapshot();
  }

  function setSelectedType(type) {
    return setValue("selectedType", TYPE_VALUES.has(type) ? type : "all");
  }

  function setSelectedShelf(shelf) {
    return setValue("selectedShelf", SHELF_VALUES.has(shelf) ? shelf : "active");
  }

  function setActiveLowerFilter(key) {
    const next = key === null ? null : (LOWER_FILTER_KEYS.has(key) ? key : null);
    return setValue("activeLowerFilter", next);
  }

  function setCounts(counts = {}) {
    const activeCount = Number.isFinite(counts.activeCount) ? Math.max(0, counts.activeCount) : state.counts.activeCount;
    const archiveCount = Number.isFinite(counts.archiveCount) ? Math.max(0, counts.archiveCount) : state.counts.archiveCount;
    if (state.counts.activeCount === activeCount && state.counts.archiveCount === archiveCount) return snapshot();
    state.counts = { activeCount, archiveCount };
    notify("counts");
    return snapshot();
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.KlevbyTripsState = {
    getState: snapshot,
    subscribe,
    setSelectedType,
    setSelectedRegion: (value) => setValue("selectedRegion", value || "all"),
    setSelectedDateMode: (value) => setValue("selectedDateMode", value || "any"),
    setSelectedFishingType: (value) => setValue("selectedFishingType", value || "any"),
    setSelectedConditions: (value) => setValue("selectedConditions", value || "any"),
    setActiveLowerFilter,
    setSelectedShelf,
    setCounts
  };
}());
