(function () {
  "use strict";

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("homeFigmaTrace") === "1") {
      document.body.setAttribute("data-home-figma-trace", "true");
    }
  } catch (_) {
    /* URL flag is optional; default Home must stay unchanged. */
  }
}());
