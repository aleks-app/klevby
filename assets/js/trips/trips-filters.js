(function () {
  "use strict";

  const TYPE_BY_INDEX = ["all", "looking", "offering"];

  function updateTabs(state) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      const isActive = TYPE_BY_INDEX[index] === state.selectedType;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("role", "tab");
    });
  }

  function updateFilterRow(state) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-filter-item").forEach((button) => {
      const key = button.getAttribute("data-trips-lower-filter");
      const isActive = Boolean(key) && state.activeLowerFilter === key;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function bindTypeTabs(stateApi) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      button.addEventListener("click", () => stateApi.setSelectedType(TYPE_BY_INDEX[index] || "all"));
    });
  }

  function bindFilterRow(stateApi) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-filter-item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-trips-lower-filter");
        if (!key || typeof stateApi.setActiveLowerFilter !== "function") return;

        const current = stateApi.getState().activeLowerFilter;
        stateApi.setActiveLowerFilter(current === key ? null : key);
      });
    });
  }

  function init(options = {}) {
    const stateApi = options.state || window.KlevbyTripsState;
    if (!stateApi) return;

    bindTypeTabs(stateApi);
    bindFilterRow(stateApi);

    const sync = (state) => {
      updateTabs(state);
      updateFilterRow(state);
    };

    sync(stateApi.getState());
    stateApi.subscribe(sync);
  }

  window.KlevbyTripsFilters = { init, updateTabs, updateFilterRow };
}());
