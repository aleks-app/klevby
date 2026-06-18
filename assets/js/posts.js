(function () {
  const POSTS_BRIDGE_VERSION = "20260618-trips-fullscreen-no-legacy-bridge-1";

  function renderPosts() {
    if (typeof window.KlevbyPostsRender?.renderPosts === "function") {
      return window.KlevbyPostsRender.renderPosts();
    }
    console.info("[Trips] fullscreen Trips create/list flow is not implemented yet");
    return false;
  }

  window.renderPosts = renderPosts;
  window.KlevbyPostsBridge = {
    renderPosts,
    version: POSTS_BRIDGE_VERSION
  };
})();
