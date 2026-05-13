(function () {
  const KLEVB_APP_GLOBAL_EVENTS_BOUND_KEY = "__klevbyAppGlobalEventsBound";

  function handleGlobalScrollOrResize() {
    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  }

  function handleAppEscapeKey(event) {
    if (event.key === "Escape" && typeof window.closePostModal === "function") {
      window.closePostModal();
    }
  }

  function setupGlobalEvents(options = {}) {
    if (window[KLEVB_APP_GLOBAL_EVENTS_BOUND_KEY]) {
      return false;
    }

    window[KLEVB_APP_GLOBAL_EVENTS_BOUND_KEY] = true;

    const onScrollOrResize = typeof options.onScrollOrResize === "function"
      ? options.onScrollOrResize
      : handleGlobalScrollOrResize;

    const onEscape = typeof options.onEscape === "function"
      ? options.onEscape
      : handleAppEscapeKey;

    window.addEventListener("scroll", () => {
      try {
        onScrollOrResize();
      } catch (error) {
        console.warn("Klevby app global events: scroll handler failed", error);
      }
    }, { passive: true });

    window.addEventListener("resize", () => {
      try {
        onScrollOrResize();
      } catch (error) {
        console.warn("Klevby app global events: resize handler failed", error);
      }
    });

    document.addEventListener("keydown", (event) => {
      try {
        onEscape(event);
      } catch (error) {
        console.warn("Klevby app global events: keydown handler failed", error);
      }
    });

    return true;
  }

  window.KlevbyAppGlobalEvents = {
    setupGlobalEvents,
    handleGlobalScrollOrResize,
    handleAppEscapeKey,
    handleEscapeKey: handleAppEscapeKey
  };

  console.log("Klevby app global events loaded", window.KlevbyAppGlobalEvents);
})();
