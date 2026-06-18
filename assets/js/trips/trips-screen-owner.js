(function () {
  "use strict";

  let initialized = false;
  let unsubscribe = null;

  function getModules() {
    return {
      state: window.KlevbyTripsState,
      lifecycle: window.KlevbyTripsLifecycle,
      filters: window.KlevbyTripsFilters,
      listOwner: window.KlevbyTripsListOwner,
      render: window.KlevbyTripsRender
    };
  }

  function init() {
    const modules = getModules();
    if (!modules.state || !modules.lifecycle || !modules.filters || !modules.listOwner || !modules.render) {
      console.warn("[Trips] foundation modules are not ready");
      return false;
    }

    if (!initialized) {
      modules.listOwner.init({ state: modules.state, lifecycle: modules.lifecycle });
      modules.filters.init({ state: modules.state });
      unsubscribe = modules.state.subscribe((state) => modules.render.renderShell(state));
      initialized = true;
    }

    modules.render.renderShell(modules.state.getState());
    return true;
  }

  function open() {
    return init();
  }

  window.KlevbyTripsScreenOwner = {
    init,
    open,
    dispose() {
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;
      initialized = false;
    }
  };

  document.addEventListener("DOMContentLoaded", init);
}());
