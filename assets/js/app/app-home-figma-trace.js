(function () {
  "use strict";

  try {
    const params = new URLSearchParams(window.location.search);
    const homeFigmaTrace = params.get("homeFigmaTrace");

    if (homeFigmaTrace === "0") {
      return;
    }

    document.body.setAttribute("data-home-figma-trace", "true");
  } catch (_) {
    document.body.setAttribute("data-home-figma-trace", "true");
  }
}());
