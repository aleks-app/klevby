(function () {
  const State = window.KlevbyPublicProfileState || {};
  const Api = window.KlevbyPublicProfileApi || {};
  const Render = window.KlevbyPublicProfileRender || {};

  function openOwnProfileFallback() {
    if (typeof window.openKlevbyProfileSafe === "function") return window.openKlevbyProfileSafe();
    if (typeof window.openKlevbyProfile === "function") return window.openKlevbyProfile();
  }

  async function openKlevbyPublicProfile(userId, fallbackData = {}) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return openOwnProfileFallback();

    const currentUserId = typeof Api.getCurrentUserId === "function" ? await Api.getCurrentUserId() : "";
    if (currentUserId && cleanUserId === currentUserId) return openOwnProfileFallback();

    State.set({ isOpen: true, userId: cleanUserId, fallbackData, loading: true, error: "" });
    Render.show();
    Render.render({ profile: null, posts: [], loading: true, error: "" });

    const result = await Api.loadPublicProfile(cleanUserId, fallbackData);
    if (!result?.ok) {
      State.set({ loading: false, error: result?.error || "load_failed" });
      return Render.render({ profile: null, posts: [], loading: false, error: result?.error || "load_failed" });
    }

    State.set({ loading: false, error: "", profile: result.profile, posts: result.posts || [] });
    Render.render({ profile: result.profile, posts: result.posts || [], loading: false, error: "" });
  }

  function closeKlevbyPublicProfile() {
    State.reset();
    Render.hide();
  }

  window.openKlevbyPublicProfile = openKlevbyPublicProfile;
  window.closeKlevbyPublicProfile = closeKlevbyPublicProfile;
})();
