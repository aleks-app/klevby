(function () {
  window.KlevbyMarket = window.KlevbyMarket || {};

  function updateMarketUiState(state) {
    const marketState = state || {};
    const marketFormOpen = Boolean(marketState.marketFormOpen);
    const marketFiltersOpen = Boolean(marketState.marketFiltersOpen);

    const formBox = document.getElementById("marketFormBox");
    const filtersBox = document.getElementById("marketFiltersBox");
    const formBtn = document.getElementById("marketToggleFormBtn");
    const filtersBtn = document.getElementById("marketToggleFiltersBtn");

    if (formBox) {
      formBox.classList.toggle("hidden", !marketFormOpen);
    }

    if (filtersBox) {
      filtersBox.classList.toggle("hidden", !marketFiltersOpen);
    }

    if (formBtn) {
      formBtn.textContent = marketFormOpen ? "Скрыть форму" : "+ Добавить товар";
      formBtn.setAttribute("aria-expanded", String(marketFormOpen));
    }

    if (filtersBtn) {
      filtersBtn.textContent = marketFiltersOpen ? "Скрыть фильтры" : "Фильтры";
      filtersBtn.setAttribute("aria-expanded", String(marketFiltersOpen));
    }
  }

  function setMarketFormOpen(state, open, options = {}) {
    const marketState = state || {};
    marketState.marketFormOpen = Boolean(open);

    updateMarketUiState(marketState);

    if (marketState.marketFormOpen && options.scroll) {
      const formBox = document.getElementById("marketFormBox");
      if (formBox) {
        setTimeout(function () {
          formBox.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 40);
      }
    }

    return marketState.marketFormOpen;
  }

  function setMarketFiltersOpen(state, open, options = {}) {
    const marketState = state || {};
    marketState.marketFiltersOpen = Boolean(open);

    updateMarketUiState(marketState);

    if (marketState.marketFiltersOpen && options.scroll) {
      const filtersBox = document.getElementById("marketFiltersBox");
      if (filtersBox) {
        setTimeout(function () {
          filtersBox.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
        }, 40);
      }
    }

    return marketState.marketFiltersOpen;
  }

  function toggleMarketForm(state) {
    const marketState = state || {};
    const nextOpen = !Boolean(marketState.marketFormOpen);

    setMarketFormOpen(marketState, nextOpen, { scroll: nextOpen });

    return marketState.marketFormOpen;
  }

  function toggleMarketFilters(state) {
    const marketState = state || {};
    const nextOpen = !Boolean(marketState.marketFiltersOpen);

    setMarketFiltersOpen(marketState, nextOpen, { scroll: nextOpen });

    return marketState.marketFiltersOpen;
  }

  function showMarketMessage(message, isError = false) {
    const el = document.getElementById("marketMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(244,251,247,0.66)";
  }

  function showMarketStatus(message, isError = false) {
    const el = document.getElementById("marketStatusLine");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("error-line", isError);
  }

  window.KlevbyMarket.updateMarketUiState = updateMarketUiState;
  window.KlevbyMarket.setMarketFormOpen = setMarketFormOpen;
  window.KlevbyMarket.setMarketFiltersOpen = setMarketFiltersOpen;
  window.KlevbyMarket.toggleMarketForm = toggleMarketForm;
  window.KlevbyMarket.toggleMarketFilters = toggleMarketFilters;
  window.KlevbyMarket.showMarketMessage = showMarketMessage;
  window.KlevbyMarket.showMarketStatus = showMarketStatus;
})();
