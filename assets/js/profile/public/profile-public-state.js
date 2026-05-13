(function () {
  const state = {
    isOpen: false,
    userId: "",
    fallbackData: null,
    profile: null,
    posts: [],
    loading: false,
    error: ""
  };

  function set(partial) {
    Object.assign(state, partial || {});
    return state;
  }

  function get() {
    return state;
  }

  function reset() {
    state.isOpen = false;
    state.userId = "";
    state.fallbackData = null;
    state.profile = null;
    state.posts = [];
    state.loading = false;
    state.error = "";
    return state;
  }

  window.KlevbyPublicProfileState = { set, get, reset };
})();
