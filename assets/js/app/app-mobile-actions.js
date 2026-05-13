(function () {
  function showSection(section) {
    if (typeof window.showSection === "function") {
      window.showSection(section);
    }
  }

  function showCreatePostScreen(options = {}) {
    if (typeof window.showCreatePostScreen === "function") {
      window.showCreatePostScreen(options);
      return;
    }

    showSection("create");
  }

  function getVisibleSectionName() {
    if (typeof window.getVisibleSectionName === "function") {
      return window.getVisibleSectionName();
    }

    if (!document.getElementById("homeSection")?.classList.contains("hidden")) return "home";
    if (!document.getElementById("tripsSection")?.classList.contains("hidden")) return "trips";
    if (!document.getElementById("createSection")?.classList.contains("hidden")) return "create";
    if (!document.getElementById("mapSection")?.classList.contains("hidden")) return "map";
    if (!document.getElementById("marketSection")?.classList.contains("hidden")) return "market";
    if (!document.getElementById("pondsSection")?.classList.contains("hidden")) return "ponds";
    if (!document.getElementById("authSection")?.classList.contains("hidden")) return "auth";
    if (!document.getElementById("profileSection")?.classList.contains("hidden")) return "profile";

    return "home";
  }

  function setMode(mode) {
    if (typeof window.setMode === "function") {
      window.setMode(mode);
      return;
    }

    showSection("trips");
  }

  function goMobileFeed() {
    showSection("home");
  }

  function goMobileMap() {
    showSection("map");
  }

  function goMobileCreate() {
    showCreatePostScreen();
  }

  function goMobileWeather() {
    showSection("home");

    setTimeout(() => {
      const panel = document.getElementById("forecastPanel");

      if (panel) {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }, 120);
  }

  function goHomeTop() {
    const visibleSection = getVisibleSectionName();

    if (visibleSection === "profile") {
      showSection("home");
      return;
    }

    if (visibleSection === "create") {
      setMode("all");
      return;
    }

    showSection("home");
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
