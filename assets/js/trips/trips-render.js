(function () {
  "use strict";

  const LIST_STATES = new Set(["idle", "loading", "empty", "populated"]);
  const LIST_STATE_BY_TYPE = {
    all: "idle",
    looking: "loading",
    offering: "populated"
  };

  function getDom() {
    return {
      count: document.querySelector("#tripsSection .trips-fullscreen-list-count"),
      title: document.querySelector("#tripsSection .trips-fullscreen-list-title"),
      listBody: document.querySelector("#tripsSection .trips-fullscreen-list-body"),
      postsRoot: document.getElementById("tripsFullscreenPostsSection"),
      activeShelf: document.getElementById("tripsFullscreenActiveShelf"),
      archiveShelf: document.getElementById("tripsFullscreenArchiveShelf")
    };
  }

  function normalizeTripsState(state) {
    if (typeof state === "string" && LIST_STATES.has(state)) return state;
    const explicitState = state?.tripsState || state?.listState || state?.dataState;
    if (LIST_STATES.has(explicitState)) return explicitState;
    const typeState = LIST_STATE_BY_TYPE[state?.selectedType];
    if (LIST_STATES.has(typeState)) return typeState;
    return "idle";
  }

  function getStateTitle(state) {
    if (state === "loading") return "Ищу компанию";
    if (state === "populated") return "Есть место";
    return "Актуальные выезды";
  }

  function getStateCount(state) {
    if (state === "loading") return "";
    if (state === "populated") return "3";
    return "0";
  }

  function renderListHeader(state) {
    const count = getStateCount(state);
    return `
      <div class="trips-fullscreen-list-header" aria-label="Список выездов">
        <div class="trips-fullscreen-list-heading">
          <h3 class="trips-fullscreen-list-title">${getStateTitle(state)}</h3>
          ${count ? `<span class="trips-fullscreen-list-count">${count}</span>` : ""}
        </div>
        <button class="trips-fullscreen-list-sort" type="button" tabindex="-1">
          <span class="trips-fullscreen-list-sort-label">Сортировка:</span>
          <span class="trips-fullscreen-list-sort-value">новые</span>
        </button>
      </div>
    `;
  }

  function renderIdle() {
    return `
      ${renderListHeader("idle")}
      <div class="trips-fullscreen-posts-section" aria-live="polite"></div>
    `;
  }

  function renderLoading() {
    return `
      ${renderListHeader("loading")}
      <div class="trips-fullscreen-posts-section" aria-live="polite">
        <div class="trips-fullscreen-skeleton"></div>
        <div class="trips-fullscreen-skeleton"></div>
        <div class="trips-fullscreen-skeleton"></div>
      </div>
    `;
  }

  function renderPopulated() {
    return `
      ${renderListHeader("populated")}
      <div class="trips-fullscreen-posts-section" aria-live="polite">
        <article class="trips-fullscreen-card">
          <div class="trips-fullscreen-card-kicker">Сегодня</div>
          <h4>Минское море</h4>
          <p>Есть место в машине, выезд утром. Спиннинг с берега.</p>
        </article>
        <article class="trips-fullscreen-card">
          <div class="trips-fullscreen-card-kicker">Завтра</div>
          <h4>Нарочь</h4>
          <p>Ищу напарника на дневной выезд, лодка на месте.</p>
        </article>
        <article class="trips-fullscreen-card">
          <div class="trips-fullscreen-card-kicker">Выходные</div>
          <h4>Березина</h4>
          <p>Свободное место, фидер и поплавок, старт из Минска.</p>
        </article>
      </div>
    `;
  }

  function getListMarkup(state) {
    if (state === "loading") return renderLoading();
    if (state === "populated") return renderPopulated();
    return renderIdle();
  }

  function renderTrips(state = "idle") {
    const dom = getDom();
    if (!dom.listBody) return "idle";

    const nextState = normalizeTripsState(state);
    dom.listBody.dataset.tripsState = nextState;
    dom.listBody.innerHTML = getListMarkup(nextState);
    return nextState;
  }

  function renderShell(state) {
    const dom = getDom();
    if (dom.count) dom.count.textContent = String(state.counts.activeCount);
    if (dom.title) dom.title.textContent = state.selectedShelf === "archive" ? "Архив выездов" : "Актуальные выезды";
    if (dom.postsRoot) dom.postsRoot.dataset.selectedShelf = state.selectedShelf;
    if (dom.activeShelf) dom.activeShelf.hidden = state.selectedShelf !== "active";
    if (dom.archiveShelf) dom.archiveShelf.hidden = state.selectedShelf !== "archive";
    renderTrips(state);
  }

  window.KlevbyTripsRender = {
    getDom,
    renderTrips,
    renderShell
  };
}());
