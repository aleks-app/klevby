(function () {
  function getCurrentUserId() {
    const user = window.currentUser || window.klevbyUser || null;
    return user?.id || user?.user_id || "";
  }

  async function open(userId, fallbackData) {
    if (!userId) return;

    const ownId = getCurrentUserId();
    if (ownId && String(ownId) === String(userId) && typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    const stateStore = window.KlevbyPublicProfileState;
    const api = window.KlevbyPublicProfileApi;
    const render = window.KlevbyPublicProfileRender;
    const gallery = window.KlevbyPublicProfileGallery;

    if (!stateStore || !api || !render || !gallery) return;

    const state = stateStore.state;
    state.isOpen = true;
    state.userId = userId;
    state.fallbackData = fallbackData || null;
    state.isLoading = true;
    state.error = null;

    render.bindClose(close);
    render.show();

    const [profile, photos] = await Promise.all([
      api.getPublicProfile(userId, fallbackData || {}),
      api.getPublicProfilePhotos(userId)
    ]);

    state.profile = profile;
    state.photos = Array.isArray(photos) ? photos : [];
    state.isLoading = false;

    render.renderProfile(profile);
    gallery.renderGallery(render.getGalleryContainer(), state.photos);
  }

  function close() {
    const stateStore = window.KlevbyPublicProfileState;
    const render = window.KlevbyPublicProfileRender;
    if (render) render.hide();
    if (stateStore) stateStore.reset();
  }

  window.KlevbyPublicProfile = { open, close };
  window.openKlevbyPublicProfile = open;
  window.closeKlevbyPublicProfile = close;
})();
