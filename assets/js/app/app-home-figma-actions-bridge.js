(() => {
  const ACTION_NAVIGATORS = {
    feed: () => {
      if (typeof window.goMobileFeed === "function") {
        window.goMobileFeed();
        return;
      }

      if (typeof window.showSection === "function") {
        window.showSection("feed");
      }
    },
    trips: () => {
      if (typeof window.goMobileTrips === "function") {
        window.goMobileTrips();
        return;
      }

      if (typeof window.showSection === "function") {
        window.showSection("trips");
      }
    },
    map: () => {
      if (typeof window.goMobileMap === "function") {
        window.goMobileMap();
        return;
      }

      if (typeof window.showSection === "function") {
        window.showSection("map");
      }
    },
  };

  function isHomeRedesignActive() {
    const home = document.getElementById("homeSection");
    return (
      document.body?.getAttribute("data-home-redesign") === "true" &&
      document.body?.getAttribute("data-app-chrome-mode") === "home" &&
      home &&
      !home.classList.contains("hidden")
    );
  }

  function bindActionCards() {
    const cards = document.querySelectorAll("#homeSection .home-figma-action-card[data-home-action]");

    cards.forEach((card) => {
      if (card.dataset.homeFigmaActionBound === "true") return;

      const action = card.getAttribute("data-home-action");
      const navigate = ACTION_NAVIGATORS[action];
      if (!navigate) return;

      card.dataset.homeFigmaActionBound = "true";
      card.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isHomeRedesignActive()) return;
        navigate();
      });
    });
  }

  function init() {
    bindActionCards();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
