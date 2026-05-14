(function () {
  function getStateModule() {
    return window.KlevbyPublicProfileState || {};
  }

  function getApiModule() {
    return window.KlevbyPublicProfileApi || {};
  }

  function getRenderModule() {
    return window.KlevbyPublicProfileRender || {};
  }

  function getCurrentUserId() {
    if (window.KlevbyProfile && typeof window.KlevbyProfile.getCurrentProfileUser === "function") {
      try {
        const user = window.KlevbyProfile.getCurrentProfileUser();
        return String(user?.id || user?.user_id || "").trim();
      } catch (_) {
        return "";
      }
    }

    return "";
  }

  async function openKlevbyPublicProfile(userId, fallbackData = {}) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return;

    const stateModule = getStateModule();
    const render = getRenderModule();
    const api = getApiModule();

    if (typeof render.ensureRoot === "function") {
      render.ensureRoot();
    }

    if (cleanUserId && cleanUserId === getCurrentUserId() && typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof stateModule.setState === "function") {
      stateModule.setState({
        isOpen: true,
        userId: cleanUserId,
        fallbackData: fallbackData && typeof fallbackData === "object" ? fallbackData : {},
        profile: null,
        photos: [],
        isLoading: true,
        error: ""
      });
    }

    if (typeof render.setOpen === "function") render.setOpen(true);
    if (typeof render.renderProfile === "function") {
      render.renderProfile({}, [], fallbackData && typeof fallbackData === "object" ? fallbackData : {});
    } else if (typeof render.renderLoading === "function") {
      render.renderLoading();
    }

    try {
      const [profile, photos] = await Promise.all([
        typeof api.getPublicProfile === "function"
          ? api.getPublicProfile(cleanUserId, fallbackData)
          : Promise.resolve(null),
        typeof api.getPublicProfilePhotos === "function"
          ? api.getPublicProfilePhotos(cleanUserId)
          : Promise.resolve([])
      ]);

      if (typeof stateModule.setState === "function") {
        stateModule.setState({
          isLoading: false,
          profile: profile || null,
          photos: Array.isArray(photos) ? photos : [],
          error: ""
        });
      }

      if (typeof render.renderProfile === "function") {
        render.renderProfile(
          profile || {},
          Array.isArray(photos) ? photos : [],
          fallbackData && typeof fallbackData === "object" ? fallbackData : {}
        );
      }
    } catch (error) {
      const message = String(error?.message || error || "");

      if (typeof stateModule.setState === "function") {
        stateModule.setState({
          isLoading: false,
          error: message || "Ошибка загрузки"
        });
      }

      if (typeof render.renderProfile === "function") {
        render.renderProfile({}, [], fallbackData && typeof fallbackData === "object" ? fallbackData : {});
      } else if (typeof render.renderError === "function") {
        render.renderError(message || "Ошибка загрузки");
      }
    }
  }

  function closeKlevbyPublicProfile() {
    const stateModule = getStateModule();
    const render = getRenderModule();

    if (typeof stateModule.resetState === "function") {
      stateModule.resetState();
    }

    if (typeof render.setOpen === "function") {
      render.setOpen(false);
    }
  }

  window.KlevbyPublicProfile = {
    open: openKlevbyPublicProfile,
    close: closeKlevbyPublicProfile,
    openKlevbyPublicProfile,
    closeKlevbyPublicProfile
  };

  window.openKlevbyPublicProfile = openKlevbyPublicProfile;
  window.closeKlevbyPublicProfile = closeKlevbyPublicProfile;
})();
