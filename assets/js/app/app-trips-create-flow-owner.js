(function () {
  "use strict";

  const TOTAL_STEPS = 6;
  const DEFAULT_DRAFT = Object.freeze({
    destination: null,
    date: null,
    duration: null,
    format: null,
    seats: null,
    fuelSplit: null
  });

  const STEPS = [
    "Куда планируете выезд?",
    "Когда планируете выезд?",
    "На сколько едете?",
    "Какой формат выезда?",
    "Сколько мест свободно?",
    "Скидываетесь на бензин?"
  ];

  let isOpen = false;
  let step = 1;
  let tripDraft = { ...DEFAULT_DRAFT };
  let overlay = null;
  let track = null;
  let titleNode = null;
  let counterNode = null;
  let nextButton = null;
  let initialized = false;
  let selectedPlaceChoice = "water";

  function publishDebug() {
    window.__KLEVBY_TRIPS_CREATE_FLOW_DEBUG__ = {
      isOpen,
      step,
      totalSteps: TOTAL_STEPS,
      draft: { ...tripDraft }
    };
  }

  function getTripsSection() {
    return document.getElementById("tripsSection");
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.className = "trips-create-flow";
    root.setAttribute("data-trips-create-flow", "closed");
    root.setAttribute("data-trips-create-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="trips-create-flow__copy" aria-labelledby="tripsCreateStep1Title">
        <h1 id="tripsCreateStep1Title" class="trips-create-flow__copy-title">
          <span>Куда планируете</span>
          <span>выезд?</span>
        </h1>
        <p class="trips-create-flow__copy-subtitle">
          <span>Выберите водоём или укажите место</span>
          <span>на карте, где планируете рыбачить.</span>
        </p>
      </div>
      <div class="trips-create-flow__place-options" aria-label="Выбор места выезда">
        <button type="button" class="trips-create-flow__place-card is-active" data-trips-create-place-choice="water" aria-pressed="true" aria-label="Выбрать водоём">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--water">
              <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                <path d="M6 18c3.2-3.6 6.4-3.6 9.6 0s6.4 3.6 9.6 0 6.4-3.6 9.6 0" />
                <path d="M6 24c3.2-3.6 6.4-3.6 9.6 0s6.4 3.6 9.6 0 6.4-3.6 9.6 0" />
                <path d="M6 30c3.2-3.6 6.4-3.6 9.6 0s6.4 3.6 9.6 0 6.4-3.6 9.6 0" />
              </svg>
            </span>
          </span>
          <span class="trips-create-flow__place-copy">
            <span class="trips-create-flow__place-title">Выбрать водоём</span>
            <span class="trips-create-flow__place-note">Из базы водоёмов</span>
          </span>
        </button>
        <button type="button" class="trips-create-flow__place-card" data-trips-create-place-choice="map" aria-pressed="false" aria-label="Указать на карте">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--map">
              <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                <path d="M8 10h18l6 6v18H8z" />
                <path d="M26 10v6h6" />
                <circle cx="17" cy="23" r="3.5" />
              </svg>
            </span>
          </span>
          <span class="trips-create-flow__place-copy">
            <span class="trips-create-flow__place-title">Указать на карте</span>
            <span class="trips-create-flow__place-note">Свободная точка</span>
          </span>
        </button>
      </div>
      <div class="trips-create-flow__panel" role="dialog" aria-modal="true" aria-labelledby="tripsCreateFlowTitle">
        <header class="trips-create-flow__header">
          <div>
            <p class="trips-create-flow__eyebrow">Новый выезд</p>
            <h2 id="tripsCreateFlowTitle" class="trips-create-flow__title"></h2>
          </div>
          <button class="trips-create-flow__close" type="button" data-trips-create-action="close" aria-label="Закрыть создание выезда">Закрыть</button>
        </header>
        <div class="trips-create-flow__viewport">
          <div class="trips-create-flow__track"></div>
        </div>
        <footer class="trips-create-flow__footer">
          <button class="trips-create-flow__nav trips-create-flow__nav--back" type="button" data-trips-create-action="back">Назад</button>
          <span class="trips-create-flow__counter" aria-live="polite"></span>
          <button class="trips-create-flow__nav trips-create-flow__nav--next" type="button" data-trips-create-action="next">Далее</button>
        </footer>
      </div>
    `;

    track = root.querySelector(".trips-create-flow__track");
    titleNode = root.querySelector(".trips-create-flow__title");
    counterNode = root.querySelector(".trips-create-flow__counter");
    nextButton = root.querySelector('[data-trips-create-action="next"]');

    STEPS.forEach((label, index) => {
      const slide = document.createElement("section");
      slide.className = "trips-create-flow__step";
      slide.setAttribute("data-trips-create-slide", String(index + 1));
      if (index !== 0) {
        slide.innerHTML = `
          <p class="trips-create-flow__step-kicker">Шаг ${index + 1} из ${TOTAL_STEPS}</p>
          <h3 class="trips-create-flow__step-title">${label}</h3>
          <p class="trips-create-flow__step-note">Поля появятся в следующих PR. Сейчас сохраняем единый draft-state и навигацию flow.</p>
        `;
      }
      track.appendChild(slide);
    });

    root.addEventListener("click", (event) => {
      const action = event.target?.closest?.("[data-trips-create-action]")?.getAttribute("data-trips-create-action");
      if (!action) return;
      if (action === "close") close();
      if (action === "back") back();
      if (action === "next") next();
    });

    const syncPlaceCards = () => {
      root.querySelectorAll("[data-trips-create-place-choice]").forEach((card) => {
        const isActive = card.dataset.tripsCreatePlaceChoice === selectedPlaceChoice;
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-pressed", String(isActive));
      });
    };

    root.addEventListener("click", (event) => {
      const placeCard = event.target.closest("[data-trips-create-place-choice]");
      if (!placeCard || !root.contains(placeCard)) return;

      selectedPlaceChoice = placeCard.dataset.tripsCreatePlaceChoice;
      tripDraft.destination = selectedPlaceChoice;
      syncPlaceCards();
      publishDebug();
    });

    syncPlaceCards();

    return root;
  }

  function ensureOverlay() {
    if (overlay && overlay.isConnected) return overlay;
    overlay = buildOverlay();
    const tripsSection = getTripsSection();
    (tripsSection || document.body).appendChild(overlay);
    return overlay;
  }

  function render() {
    ensureOverlay();
    overlay.setAttribute("data-trips-create-flow", isOpen ? "open" : "closed");
    overlay.setAttribute("data-trips-create-step", String(step));
    overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    titleNode.textContent = STEPS[step - 1];
    counterNode.textContent = `${step} / ${TOTAL_STEPS}`;
    track.style.transform = `translateX(-${(step - 1) * 100}%)`;
    nextButton.textContent = step === TOTAL_STEPS ? "Публикация позже" : "Далее";
    nextButton.disabled = step === TOTAL_STEPS;
    if (step === 1 && overlay) {
      overlay.querySelectorAll("[data-trips-create-place-choice]").forEach((card) => {
        const isActive = card.dataset.tripsCreatePlaceChoice === selectedPlaceChoice;
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-pressed", String(isActive));
      });
    }
    publishDebug();
  }

  function open() {
    ensureOverlay();
    isOpen = true;
    step = 1;
    tripDraft = { ...DEFAULT_DRAFT };
    selectedPlaceChoice = "water";
    tripDraft.destination = "water";
    render();
  }

  function close() {
    isOpen = false;
    render();
  }

  function back() {
    if (step <= 1) {
      close();
      return;
    }
    step -= 1;
    render();
  }

  function next() {
    if (step >= TOTAL_STEPS) {
      console.info("[TripsCreateFlow] Publishing is intentionally not implemented yet", { draft: { ...tripDraft } });
      return;
    }
    step += 1;
    render();
  }

  function init() {
    if (initialized) return true;
    const tripsSection = getTripsSection();
    if (!tripsSection) return false;

    tripsSection.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-trips-create-open]")) return;
      event.preventDefault();
      open();
    });

    ensureOverlay();
    render();
    initialized = true;
    return true;
  }

  window.KlevbyTripsCreateFlowOwner = {
    init,
    open,
    close,
    back,
    next,
    isOpen() {
      return isOpen;
    },
    getDebug: () => ({ isOpen, step, totalSteps: TOTAL_STEPS, draft: { ...tripDraft } })
  };

  document.addEventListener("DOMContentLoaded", init);
  publishDebug();
}());
