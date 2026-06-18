(function () {
  function showSection(section, dependencies = {}) {
    if (typeof dependencies.showSection === "function") {
      dependencies.showSection(section);
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection(section);
    }
  }

  function showCreatePostScreen(options = {}, dependencies = {}) {
    console.info("[Trips] create trip flow is not implemented yet");
    return false;
  }

  function getVisibleSectionName(dependencies = {}) {
    if (typeof dependencies.getVisibleSectionName === "function") {
      return dependencies.getVisibleSectionName();
    }

    if (typeof window.getVisibleSectionName === "function") {
      return window.getVisibleSectionName();
    }

    if (!document.getElementById("homeSection")?.classList.contains("hidden")) return "home";
    if (!document.getElementById("feedSection")?.classList.contains("hidden")) return "feed";
    if (!document.getElementById("tripsSection")?.classList.contains("hidden")) return "trips";
    if (!document.getElementById("mapSection")?.classList.contains("hidden")) return "map";
    if (!document.getElementById("marketSection")?.classList.contains("hidden")) return "market";
    if (!document.getElementById("pondsSection")?.classList.contains("hidden")) return "ponds";
    if (!document.getElementById("authSection")?.classList.contains("hidden")) return "auth";
    if (!document.getElementById("profileSection")?.classList.contains("hidden")) return "profile";

    return "home";
  }

  function updateHomeFloatButtonSafe() {
    setTimeout(() => {
      if (typeof window.updateHomeFloatButton === "function") {
        window.updateHomeFloatButton();
      }
    }, 120);
  }

  function scrollPageTop() {
    try {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (_) {
      window.scrollTo(0, 0);
    }

    updateHomeFloatButtonSafe();
  }

  function setMode(mode, dependencies = {}) {
    if (typeof dependencies.setMode === "function") {
      dependencies.setMode(mode);
      return;
    }

    if (typeof window.setMode === "function") {
      window.setMode(mode);
      return;
    }

    showSection("trips", dependencies);
  }

  function goMobileFeed(dependencies = {}) {
    showSection("feed", dependencies);
    scrollPageTop();
  }

  function goMobileMap(dependencies = {}) {
    showSection("map", dependencies);
  }

  function goMobileCreate(dependencies = {}) {
    showCreatePostScreen({}, dependencies);
  }

  function goMobileWeather(dependencies = {}) {
    showSection("home", dependencies);

    setTimeout(() => {
      const panel = document.getElementById("forecastPanel");

      if (panel) {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      updateHomeFloatButtonSafe();
    }, 120);
  }

  function goHomeTop(dependencies = {}) {
    const visibleSection = getVisibleSectionName(dependencies);

    if (visibleSection === "home") {
      scrollPageTop();
      return;
    }

    if (visibleSection === "create") {
      setMode("all", dependencies);
      updateHomeFloatButtonSafe();
      return;
    }

    showSection("home", dependencies);
    scrollPageTop();
  }

  window.KlevbyAppMobileActions = {
    goMobileFeed,
    goMobileMap,
    goMobileCreate,
    goMobileWeather,
    goHomeTop
  };

  console.log("Klevby app mobile actions loaded");
})();
