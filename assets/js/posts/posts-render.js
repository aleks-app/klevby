(function () {
  const POSTS_RENDER_VERSION = "20260618-trips-fullscreen-no-legacy-render-1";

  function renderPosts() {
    console.info("[Trips] fullscreen Trips create/list flow is not implemented yet");
    return false;
  }

  function setMineTripsModeButtons() {
    return false;
  }

  window.KlevbyPostsRender = {
    renderPosts,
    setMineTripsModeButtons,
    version: POSTS_RENDER_VERSION
  };

  window.renderPosts = renderPosts;
})();
