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

function updateHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");
  const homeSection = document.getElementById("homeSection");

  if (!btn || !homeSection) return;

  const isNotHome = homeSection.classList.contains("hidden");
  const isScrolledDown = window.scrollY > 300;

  btn.classList.toggle("show", isNotHome || isScrolledDown);
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
window.getMobileTabButtons = getMobileTabButtons;
window.setMobileTabActive = setMobileTabActive;
window.scrollToPosts = scrollToPosts;
window.mobileScrollTo = mobileScrollTo;
window.scrollToProfilePhotos = scrollToProfilePhotos;

console.log("Klevby UI shell loaded");
