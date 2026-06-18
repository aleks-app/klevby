(function () {
  "use strict";

  let stateApi = null;
  let lifecycleApi = null;
  let trips = [];

  function getShelves() {
    return {
      postsRoot: document.getElementById("tripsFullscreenPostsSection"),
      activeShelf: document.getElementById("tripsFullscreenActiveShelf"),
      archiveShelf: document.getElementById("tripsFullscreenArchiveShelf")
    };
  }

  function syncCounts() {
    if (!stateApi || !lifecycleApi) return;
    const shelves = lifecycleApi.partitionTrips(trips);
    stateApi.setCounts({
      activeCount: shelves.active.length,
      archiveCount: shelves.archive.length
    });
  }

  function setTrips(nextTrips) {
    trips = Array.isArray(nextTrips) ? nextTrips.slice() : [];
    syncCounts();
  }

  function init(options = {}) {
    stateApi = options.state || window.KlevbyTripsState;
    lifecycleApi = options.lifecycle || window.KlevbyTripsLifecycle;
    getShelves();
    syncCounts();
  }

  window.KlevbyTripsListOwner = {
    init,
    setTrips,
    getShelves
  };
}());
