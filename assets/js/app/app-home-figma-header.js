(function () {
  const VERSION = "20260626-home-figma-menu-bridge-1";

  function isHomeRedesignActive() {
    const home = document.getElementById("homeSection");
    return (
      document.body?.getAttribute("data-home-redesign") === "true" &&
      document.body?.getAttribute("data-app-chrome-mode") === "home" &&
      home &&
      !home.classList.contains("hidden")
    );
  }

  function getMobileMenuWrap() {
    return document.querySelector("header .mobile-menu-wrap");
  }

  function clearMobileMenuAnchor(menu) {
    if (!menu) return;

    menu.style.position = "";
    menu.style.top = "";
    menu.style.right = "";
    menu.style.left = "";
    menu.style.zIndex = "";
  }

  function anchorMobileMenuToFigmaButton(menu, button) {
    if (!menu || !button) return;

    const rect = button.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    menu.style.left = "auto";
    menu.style.zIndex = "2147483000";
  }

  function portalMobileMenuIfNeeded(menu) {
    const wrap = getMobileMenuWrap();
    if (!menu || !wrap || menu.parentElement === document.body) return;

    wrap.dataset.homeFigmaMenuPortaled = "true";
    document.body.appendChild(menu);
  }

  function restoreMobileMenuIfNeeded(menu) {
    const wrap = getMobileMenuWrap();
    if (!menu || !wrap || wrap.dataset.homeFigmaMenuPortaled !== "true") return;

    wrap.appendChild(menu);
    delete wrap.dataset.homeFigmaMenuPortaled;
    clearMobileMenuAnchor(menu);
  }

  function syncHomeFigmaMenuButtonState(button) {
    const menu = document.getElementById("mobileMenu");
    if (!button || !menu) return;

    const isOpen = menu.classList.contains("open");
    button.setAttribute("aria-expanded", String(isOpen));
    button.classList.toggle("open", isOpen);
  }

  function syncHomeRedesignMobileMenu(button) {
    const menu = document.getElementById("mobileMenu");
    if (!menu) return;

    if (!isHomeRedesignActive()) {
      restoreMobileMenuIfNeeded(menu);
      return;
    }

    if (menu.classList.contains("open")) {
      portalMobileMenuIfNeeded(menu);
      if (button) {
        anchorMobileMenuToFigmaButton(menu, button);
      }
    } else {
      restoreMobileMenuIfNeeded(menu);
    }

    if (button) {
      syncHomeFigmaMenuButtonState(button);
    }
  }

  function toggleHomeRedesignMobileMenu(button) {
    const legacyBurger = document.getElementById("burgerBtn");

    if (typeof window.toggleMobileMenu === "function") {
      window.toggleMobileMenu();
    } else if (legacyBurger) {
      legacyBurger.click();
    } else {
      return;
    }

    syncHomeRedesignMobileMenu(button);
  }

  function observeMobileMenu(button) {
    const menu = document.getElementById("mobileMenu");
    if (!menu || menu.dataset.homeFigmaMenuObserved === "true") return;

    menu.dataset.homeFigmaMenuObserved = "true";
    const observer = new MutationObserver(function () {
      syncHomeRedesignMobileMenu(button);
    });
    observer.observe(menu, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function observeHomeRedesignState(button) {
    if (document.body.dataset.homeFigmaRedesignObserved === "true") return;

    document.body.dataset.homeFigmaRedesignObserved = "true";
    const observer = new MutationObserver(function () {
      syncHomeRedesignMobileMenu(button);
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-home-redesign", "data-app-chrome-mode"],
    });

    const home = document.getElementById("homeSection");
    if (home) {
      observer.observe(home, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

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
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleHomeRedesignMobileMenu(button);
    });

    observeMobileMenu(button);
    observeHomeRedesignState(button);
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
      subtree: true,
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
  window.addEventListener("resize", function () {
    syncHomeRedesignMobileMenu(document.querySelector("#homeSection .home-figma-menu-button"));
  });
  window.KlevbyHomeFigmaHeader = { version: VERSION, syncAvatar: syncHomeFigmaAvatar };
})();
