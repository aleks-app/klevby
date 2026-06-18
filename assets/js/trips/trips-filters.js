(function () {
  "use strict";

  const TYPE_BY_INDEX = ["all", "looking", "offering"];
  let activeFilterIndex = null;

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

  function syncFilterState(stateApi, nextIndex) {
    if (typeof stateApi.setSelectedRegion !== "function") return;

    stateApi.setSelectedRegion("all");
    stateApi.setSelectedDateMode("any");
    stateApi.setSelectedFishingType("any");
    stateApi.setSelectedConditions("any");

    if (nextIndex === 0) stateApi.setSelectedRegion("touched");
    if (nextIndex === 1) stateApi.setSelectedDateMode("touched");
    if (nextIndex === 2) stateApi.setSelectedFishingType("touched");
    if (nextIndex === 3) stateApi.setSelectedConditions("touched");
  }

  function bindFilterRow(stateApi) {
    const buttons = document.querySelectorAll("#tripsSection .trips-fullscreen-filter-item");

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => {
        const wasActive = activeFilterIndex === index;

        buttons.forEach((item) => {
          item.classList.remove("is-active");
          item.setAttribute("aria-pressed", "false");
        });

        if (wasActive) {
          activeFilterIndex = null;
          syncFilterState(stateApi, null);
          return;
        }

        button.classList.add("is-active");
        button.setAttribute("aria-pressed", "true");
        activeFilterIndex = index;
        syncFilterState(stateApi, index);
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
