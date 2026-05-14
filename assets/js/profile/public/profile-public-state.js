(function () {
  const state = {
    isOpen: false,
    userId: "",
    fallbackData: null,
    profile: null,
    photos: [],
    isLoading: false,
    error: null
  };

  function reset() {
    state.isOpen = false;
    state.userId = "";
    state.fallbackData = null;
    state.profile = null;
    state.photos = [];
    state.isLoading = false;
    state.error = null;
  }

  window.KlevbyPublicProfileState = {
    state,
    reset
  };
})();
