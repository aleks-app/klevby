(function () {
  let profileOpenPatched = false;
  let originalOpenProfile = null;

  function markProfileReturnMode() {
    setProfileReturnMode(true);
  }

  function setProfileReturnMode(enabled) {
    const value = Boolean(enabled);

    try {
      if (value) {
        sessionStorage.setItem("klevby_profile_return_mode", "1");
      } else {
        sessionStorage.removeItem("klevby_profile_return_mode");
      }

      window.__klevbyProfileReturnMode = value;
    } catch (error) {
      window.__klevbyProfileReturnMode = value;
    }

    return value;
  }

  function hideAllAppSectionsExcept(activeId) {
    if (typeof window.hideAllAppSectionsExcept === "function") {
      window.hideAllAppSectionsExcept(activeId);
      return;
    }

    [
      "homeSection",
      "tripsSection",
      "createSection",
      "marketSection",
      "pondsSection",
      "mapSection",
      "authSection",
      "profileSection"
    ].forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;

      section.classList.toggle("hidden", id !== activeId);
    });
  }

  function setMobileTabVisual(index) {
    if (typeof window.setMobileTabVisual === "function") {
      window.setMobileTabVisual(index);
      return;
    }

    const buttons = Array.from(document.querySelectorAll(".mobile-tabbar .mobile-tab-btn"));

    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("active", Number.isInteger(index) && buttonIndex === index);
    });
  }

  function showCreatePostScreen(options = {}) {
    if (typeof window.showCreatePostScreen === "function") {
      window.showCreatePostScreen(options);
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("create");
    }
  }

  function setMode(mode) {
    if (typeof window.setMode === "function") {
      window.setMode(mode);
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("trips");
    }
  }

  function patchProfileOpenForExtraSections() {
    if (profileOpenPatched) return true;

    if (typeof window.openKlevbyProfile !== "function") {
      return false;
    }

    if (window.openKlevbyProfile.__klevbyAppProfilePatched) {
      profileOpenPatched = true;
      return true;
    }

    originalOpenProfile = window.openKlevbyProfile;

    window.openKlevbyProfile = function patchedOpenKlevbyProfile() {
      hideAllAppSectionsExcept("profileSection");

      const result = originalOpenProfile.apply(this, arguments);

      const tripsSection = document.getElementById("tripsSection");
      const createSection = document.getElementById("createSection");

      if (tripsSection) tripsSection.classList.add("hidden");
      if (createSection) createSection.classList.add("hidden");

      setMobileTabVisual(null);

      return result;
    };

    window.openKlevbyProfile.__klevbyAppProfilePatched = true;
    window.openKlevbyProfile.__klevbyOriginalOpenProfile = originalOpenProfile;

    profileOpenPatched = true;
    return true;
  }

  function patchProfileShortcutActions() {
    window.openProfileCreateView = function patchedOpenProfileCreateView() {
      markProfileReturnMode();
      showCreatePostScreen({ fromProfile: true });
    };

    window.openProfileTripsView = function patchedOpenProfileTripsView() {
      markProfileReturnMode();
      setMode("mine");
    };

    return true;
  }

  window.KlevbyAppProfilePatches = {
    setProfileReturnMode,
    patchProfileOpenForExtraSections,
    patchProfileShortcutActions,
    isProfileOpenPatched() {
      return profileOpenPatched;
    },
    getOriginalOpenProfile() {
      return originalOpenProfile;
    }
  };

  console.log("Klevby app profile patches loaded");
})();
