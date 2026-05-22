function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const btn = document.getElementById("burgerBtn");
  if (!menu || !btn) return;

  const isOpen = menu.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
  btn.setAttribute("aria-expanded", String(isOpen));
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const btn = document.getElementById("burgerBtn");
  if (!menu || !btn) return;

  menu.classList.remove("open");
  btn.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function closeMobileMenuSafe() {
  try {
    if (typeof closeMobileMenu === "function") {
      closeMobileMenu();
      return;
    }

    const menu = document.getElementById("mobileMenu");
    const burger = document.getElementById("burgerBtn");

    if (menu) menu.classList.remove("open");
    if (burger) {
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  } catch (error) {
    console.warn("Klevby UI: menu close skipped", error);
  }
}

function getVisibleSectionName() {
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

function setHomeFloatButtonMode(btn, mode) {
  if (!btn) return;

  if (mode === "top") {
    btn.textContent = "↑";
    btn.dataset.floatMode = "top";
    btn.dataset.floatIcon = "↑";
    btn.setAttribute("aria-label", "Наверх");
    btn.setAttribute("title", "Наверх");
    return;
  }

  if (mode === "back") {
    btn.textContent = "←";
    btn.dataset.floatMode = "back";
    btn.dataset.floatIcon = "←";
    btn.setAttribute("aria-label", "Вернуться в ленту");
    btn.setAttribute("title", "В ленту");
    return;
  }

  btn.textContent = "";
  btn.dataset.floatMode = "";
  btn.dataset.floatIcon = "";
  btn.removeAttribute("title");
}

function updateHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");
  const homeSection = document.getElementById("homeSection");

  if (!btn || !homeSection) return;

  const visibleSection = getVisibleSectionName();
  const isScrolledDown = window.scrollY > 300;

  if (visibleSection === "home") {
    setHomeFloatButtonMode(btn, "top");
    btn.classList.toggle("show", isScrolledDown);
    return;
  }

  if (visibleSection === "market") {
    setHomeFloatButtonMode(btn, "");
    btn.classList.remove("show");
    return;
  }

  setHomeFloatButtonMode(btn, "back");
  btn.classList.add("show");
}

function getMobileTabButtons() {
  return Array.from(document.querySelectorAll(".mobile-tab-btn"));
}

function setMobileTabActive(index) {
  const buttons = getMobileTabButtons();

  buttons.forEach((button, i) => {
    button.classList.toggle("active", Number.isInteger(index) && i === index);
  });
}

function scrollToPosts() {
  const postsSection = document.getElementById("postsSection");
  if (!postsSection) return;

  postsSection.scrollIntoView({ behavior: "smooth" });
}

function mobileScrollTo(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setTimeout(updateHomeFloatButton, 120);
  }, 80);
}

function scrollToProfilePhotos() {
  setTimeout(() => {
    const profileContent = document.querySelector(".profile-content-card");

    if (profileContent) {
      profileContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setTimeout(updateHomeFloatButton, 120);
  }, 100);
}

window.KlevbyUiShell = {
  toggleMobileMenu,
  closeMobileMenu,
  closeMobileMenuSafe,
  updateHomeFloatButton,
  getVisibleSectionName,
  setHomeFloatButtonMode,
  getMobileTabButtons,
  setMobileTabActive,
  scrollToPosts,
  mobileScrollTo,
  scrollToProfilePhotos
};

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.closeMobileMenuSafe = closeMobileMenuSafe;
window.updateHomeFloatButton = updateHomeFloatButton;
window.getVisibleSectionName = getVisibleSectionName;
window.setHomeFloatButtonMode = setHomeFloatButtonMode;
window.getMobileTabButtons = getMobileTabButtons;
window.setMobileTabActive = setMobileTabActive;
window.scrollToPosts = scrollToPosts;
window.mobileScrollTo = mobileScrollTo;
window.scrollToProfilePhotos = scrollToProfilePhotos;

console.log("Klevby UI shell loaded");
