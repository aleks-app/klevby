(function () {
  function normalizeMode(mode) {
    return mode === "mine" ? "mine" : "all";
  }

  function setProfileReturnMode(enabled) {
    const value = Boolean(enabled);

    try {
      if (value) {
        sessionStorage.setItem("klevby_profile_return_mode", "1");
      } else {
        sessionStorage.removeItem("klevby_profile_return_mode");
      }

      window.__klevbyProfileReturnMode = value;
    } catch (error) {
      window.__klevbyProfileReturnMode = value;
    }
  }

  function setMode(mode, dependencies = {}) {
    const nextMode = normalizeMode(mode);

    if (nextMode === "mine") {
      if (typeof dependencies.setMineTripsMode === "function") {
        dependencies.setMineTripsMode("active");
      } else if (typeof window.KlevbyPostsState?.setMineTripsMode === "function") {
        window.KlevbyPostsState.setMineTripsMode("active");
      }
    }

    if (typeof dependencies.setViewMode === "function") {
      dependencies.setViewMode(nextMode);
    } else {
      window.klevbyViewMode = nextMode;
    }

    if (typeof dependencies.showSection === "function") {
      dependencies.showSection("trips");
    } else if (typeof window.showSection === "function") {
      window.showSection("trips");
    }

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }

    return nextMode;
  }

  function setMineTripsMode(mode, dependencies = {}) {
    const nextMode = mode === "expired" ? "expired" : "active";

    if (typeof dependencies.setMineTripsMode === "function") {
      dependencies.setMineTripsMode(nextMode);
    } else if (typeof window.KlevbyPostsState?.setMineTripsMode === "function") {
      window.KlevbyPostsState.setMineTripsMode(nextMode);
    } else {
      window.klevbyMineTripsMode = nextMode;
    }

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }

    return nextMode;
  }

  function showTripsBoard(mode = "all", dependencies = {}) {
    return setMode(mode, dependencies);
  }

  function showCreatePostScreen(options = {}, dependencies = {}) {
    console.info("[Trips] create trip flow is not implemented yet", { options, dependencies });
    return false;
  }


  window.KlevbyAppTripActions = {
    setMode,
    setMineTripsMode,
    showTripsBoard,
    showCreatePostScreen,
    setProfileReturnMode
  };

  console.log("Klevby app trip actions loaded", window.KlevbyAppTripActions);
})();
