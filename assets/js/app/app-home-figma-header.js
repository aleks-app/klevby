(function () {
  const VERSION = "20260626-home-figma-avatar-2";

  function copyAvatarState(source, target) {
    if (!source || !target) return;

    target.textContent = source.textContent || "";
    target.style.backgroundImage = source.style.backgroundImage || "";
    target.style.backgroundSize = source.style.backgroundSize || "";
    target.style.backgroundPosition = source.style.backgroundPosition || "";
    target.style.backgroundRepeat = source.style.backgroundRepeat || "";
    target.classList.add("home-figma-profile-avatar-icon");
  }

  function syncHomeFigmaAvatar() {
    const source = document.getElementById("mobileProfileAvatarIcon");
    const target = document.querySelector("#homeSection .home-figma-profile-avatar-icon");
    copyAvatarState(source, target);
  }

  function bindMenuButton() {
    const button = document.querySelector("#homeSection .home-figma-menu-button");
    if (!button || button.dataset.homeFigmaMenuBound === "true") return;

    button.dataset.homeFigmaMenuBound = "true";
    button.addEventListener("click", function () {
      if (typeof window.toggleMobileMenu === "function") {
        window.toggleMobileMenu();
      }
    });
  }

  function bindProfileButton() {
    const redesignProfileButton = document.querySelector("#homeSection .home-figma-profile-button");
    if (!redesignProfileButton || redesignProfileButton.dataset.homeFigmaProfileBound === "true") return;

    redesignProfileButton.dataset.homeFigmaProfileBound = "true";
    redesignProfileButton.addEventListener("click", function () {
      const realProfileButton = document.getElementById("mobileProfileBtn");

      if (realProfileButton) {
        realProfileButton.click();
        return;
      }

      if (typeof window.openKlevbyProfile === "function") {
        window.openKlevbyProfile();
      }
    });
  }

  function observeHeaderAvatar() {
    const source = document.getElementById("mobileProfileAvatarIcon");
    if (!source || source.dataset.homeFigmaAvatarObserved === "true") return;

    source.dataset.homeFigmaAvatarObserved = "true";
    const observer = new MutationObserver(syncHomeFigmaAvatar);
    observer.observe(source, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function initHomeFigmaHeader() {
    bindMenuButton();
    bindProfileButton();
    observeHeaderAvatar();
    syncHomeFigmaAvatar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeFigmaHeader, { once: true });
  } else {
    initHomeFigmaHeader();
  }

  window.addEventListener("klevby-profile-avatar-updated", syncHomeFigmaAvatar);
  window.addEventListener("storage", syncHomeFigmaAvatar);
  window.KlevbyHomeFigmaHeader = { version: VERSION, syncAvatar: syncHomeFigmaAvatar };
})();
