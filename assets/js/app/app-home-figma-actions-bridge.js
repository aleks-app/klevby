(() => {
  const FEED_VIEW_ALL_ID = "klevgo-home-figma-feed-view-all";

  function isHomeRedesignActive() {
    const home = document.getElementById("homeSection");
    return (
      document.body?.getAttribute("data-home-redesign") === "true" &&
      document.body?.getAttribute("data-app-chrome-mode") === "home" &&
      home &&
      !home.classList.contains("hidden")
    );
  }

  function navigateToFeed() {
    if (typeof window.goMobileFeed === "function") {
      window.goMobileFeed();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("feed");
    }
  }

  const ACTION_NAVIGATORS = {
    feed: navigateToFeed,
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

  function bindFeedViewAll() {
    const control = document.getElementById(FEED_VIEW_ALL_ID);
    if (!control || control.dataset.homeFigmaViewAllBound === "true") return;

    control.dataset.homeFigmaViewAllBound = "true";
    control.style.pointerEvents = "auto";
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isHomeRedesignActive()) return;
      navigateToFeed();
    });
  }

  function observeFeedViewAll() {
    if (document.body.dataset.homeFigmaViewAllObserved === "true") return;

    document.body.dataset.homeFigmaViewAllObserved = "true";
    bindFeedViewAll();

    const observer = new MutationObserver(() => {
      bindFeedViewAll();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
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
    observeFeedViewAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
