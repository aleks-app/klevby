(function () {
  const state = {
    isOpen: false,
    userId: "",
    fallbackData: {},
    profile: null,
    photos: [],
    isLoading: false,
    error: ""
  };

  function getState() {
    return {
      ...state,
      fallbackData: { ...(state.fallbackData || {}) },
      profile: state.profile ? { ...state.profile } : null,
      photos: Array.isArray(state.photos) ? state.photos.slice() : []
    };
  }

  function setState(patch = {}) {
    if (!patch || typeof patch !== "object") return getState();

    Object.assign(state, patch);

    if (!Array.isArray(state.photos)) {
      state.photos = [];
    }

    if (!state.fallbackData || typeof state.fallbackData !== "object") {
      state.fallbackData = {};
    }

    return getState();
  }

  function resetState() {
    state.isOpen = false;
    state.userId = "";
    state.fallbackData = {};
    state.profile = null;
    state.photos = [];
    state.isLoading = false;
    state.error = "";

    return getState();
  }

  window.KlevbyPublicProfileState = {
    getState,
    setState,
    resetState
  };
})();
