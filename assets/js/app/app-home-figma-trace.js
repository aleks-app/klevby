(function () {
  "use strict";

  const TRACE_FLAG = "homeFigmaTrace";
  const TRACE_ENABLED_VALUE = "1";
  const HOME_REDESIGN_ATTRIBUTE = "data-home-redesign";

  function isHomeFigmaTraceEnabled() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(TRACE_FLAG) === TRACE_ENABLED_VALUE;
    } catch (_) {
      return false;
    }
  }

  document.body.setAttribute(HOME_REDESIGN_ATTRIBUTE, "true");

  if (isHomeFigmaTraceEnabled()) {
    document.body.setAttribute("data-home-figma-trace", "true");
  } else {
    document.body.removeAttribute("data-home-figma-trace");
  }
}());
