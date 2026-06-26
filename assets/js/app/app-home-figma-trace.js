(function () {
  "use strict";

  const TRACE_FLAG = "homeFigmaTrace";
  const TRACE_ENABLED_VALUE = "1";

  function isHomeFigmaTraceEnabled() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(TRACE_FLAG) === TRACE_ENABLED_VALUE;
    } catch (_) {
      return false;
    }
  }

  if (isHomeFigmaTraceEnabled()) {
    document.body.setAttribute("data-home-figma-trace", "true");
  } else {
    document.body.removeAttribute("data-home-figma-trace");
  }
}());
