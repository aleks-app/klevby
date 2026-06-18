(function () {
  "use strict";

  const TYPE_BY_INDEX = ["all", "looking", "offering"];
  const FILTER_KEYS = ["selectedRegion", "selectedDateMode", "selectedFishingType", "selectedConditions"];

  function updateTabs(state) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      const isActive = TYPE_BY_INDEX[index] === state.selectedType;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("role", "tab");
    });
  }

  function bindTypeTabs(stateApi) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      button.addEventListener("click", () => stateApi.setSelectedType(TYPE_BY_INDEX[index] || "all"));
    });
  }

  function bindFilterRow(stateApi) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-filter-item").forEach((button, index) => {
      button.addEventListener("click", () => {
        const key = FILTER_KEYS[index];
        button.classList.toggle("is-active");
        button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");
        if (key && typeof stateApi.setSelectedRegion === "function") {
          const value = button.classList.contains("is-active") ? "touched" : "any";
          if (key === "selectedRegion") stateApi.setSelectedRegion(value === "any" ? "all" : value);
          if (key === "selectedDateMode") stateApi.setSelectedDateMode(value);
          if (key === "selectedFishingType") stateApi.setSelectedFishingType(value);
          if (key === "selectedConditions") stateApi.setSelectedConditions(value);
        }
      });
    });
  }

  function init(options = {}) {
    const stateApi = options.state || window.KlevbyTripsState;
    if (!stateApi) return;
    bindTypeTabs(stateApi);
    bindFilterRow(stateApi);
    updateTabs(stateApi.getState());
    stateApi.subscribe((state) => updateTabs(state));
  }

  window.KlevbyTripsFilters = { init, updateTabs };
}());
