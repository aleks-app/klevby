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

function updateHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");
  const homeSection = document.getElementById("homeSection");

  if (!btn || !homeSection) return;

  const isNotHome = homeSection.classList.contains("hidden");
  const isScrolledDown = window.scrollY > 300;

  btn.classList.toggle("show", isNotHome || isScrolledDown);
}

function goHomeTop() {
  setMobileTabActive(0);
  showSection("home");

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateHomeFloatButton();
  }, 80);
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

function setMobileTabActive(index) {
  const buttons = document.querySelectorAll(".mobile-tab-btn");
  buttons.forEach((button, i) => {
    button.classList.toggle("active", i === index);
  });
}

function goMobileFeed() {
  setMobileTabActive(0);
  showSection("home");
  mobileScrollTo("postsSection");
}

function goMobileCreate() {
  setMobileTabActive(2);
  showSection("home");
  mobileScrollTo("createPanel");
}

function goMobileMap() {
  setMobileTabActive(1);
  showSection("map");
}

function goMobileWeather() {
  setMobileTabActive(3);
  showSection("home");
  mobileScrollTo("forecastPanel");
}

function goMobileProfile() {
  setMobileTabActive(4);
  showSection("auth");
}

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.updateHomeFloatButton = updateHomeFloatButton;
window.goHomeTop = goHomeTop;
window.scrollToPosts = scrollToPosts;
window.mobileScrollTo = mobileScrollTo;
window.setMobileTabActive = setMobileTabActive;
window.goMobileFeed = goMobileFeed;
window.goMobileCreate = goMobileCreate;
window.goMobileMap = goMobileMap;
window.goMobileWeather = goMobileWeather;
window.goMobileProfile = goMobileProfile;
