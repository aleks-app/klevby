(function () {
  "use strict";

  const TYPE_BY_INDEX = ["all", "looking", "offering"];
  const LIST_STATE_BY_TYPE = {
    all: "idle",
    looking: "loading",
    offering: "populated"
  };

  function getTypeByIndex(index) {
    return TYPE_BY_INDEX[index] || "all";
  }

  function getListStateByType(type) {
    return LIST_STATE_BY_TYPE[type] || "idle";
  }

  function getRenderApi() {
    return window.KlevbyTripsRender || null;
  }

  function updateTabs(state) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      const isActive = getTypeByIndex(index) === state.selectedType;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("role", "tab");
    });
  }

  function renderTypeState(type) {
    const renderApi = getRenderApi();
    if (typeof renderApi?.renderTrips !== "function") return;
    renderApi.renderTrips(getListStateByType(type));
  }

  function bindTypeTabs(stateApi) {
    document.querySelectorAll("#tripsSection .trips-fullscreen-type-tab").forEach((button, index) => {
      button.addEventListener("click", () => {
        const nextType = getTypeByIndex(index);
        stateApi.setSelectedType(nextType);
        renderTypeState(nextType);
      });
    });
  }

  function init(options = {}) {
    const stateApi = options.state || window.KlevbyTripsState;
    if (!stateApi) return;
    bindTypeTabs(stateApi);
    updateTabs(stateApi.getState());
    stateApi.subscribe((state) => {
      updateTabs(state);
      renderTypeState(state.selectedType);
    });
  }

  window.KlevbyTripsFilters = { init, updateTabs, renderTypeState };
}());
