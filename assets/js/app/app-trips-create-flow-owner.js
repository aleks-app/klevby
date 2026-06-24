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
        <button type="button" class="trips-create-flow__place-card trips-create-flow__place-card--primary" data-trips-create-place-choice="water" aria-label="Выбрать водоём">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--water">
              <svg viewBox="0 0 40 40" focusable="false">
                <path d="M7 14c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" />
                <path d="M7 20c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" />
                <path d="M7 26c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" />
              </svg>
            </span>
          </span>
          <span class="trips-create-flow__place-copy">
            <span class="trips-create-flow__place-title">Выбрать водоём</span>
            <span class="trips-create-flow__place-subtitle">Из базы водоёмов</span>
          </span>
        </button>
        <button type="button" class="trips-create-flow__place-card trips-create-flow__place-card--secondary" data-trips-create-place-choice="map" aria-label="Указать на карте">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--map">
              <svg viewBox="0 0 40 40" focusable="false">
                <path d="M9 10.5L17 7.5L24 10.5L31 7.5V29.5L24 32.5L17 29.5L9 32.5V10.5Z" />
                <path d="M17 7.5V29.5" />
                <path d="M24 10.5V32.5" />
              </svg>
            </span>
          </span>
          <span class="trips-create-flow__place-copy">
            <span class="trips-create-flow__place-title">Указать на карте</span>
            <span class="trips-create-flow__place-subtitle">Свободная точка</span>
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

    const setTripsCreatePlaceChoice = (choice) => {
      root.dataset.tripsCreatePlaceChoice = choice;

      root.querySelectorAll("[data-trips-create-place-choice]").forEach((card) => {
        const isActive = card.dataset.tripsCreatePlaceChoice === choice;
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-pressed", String(isActive));
      });
    };

    root.addEventListener("click", (event) => {
      const placeCard = event.target.closest("[data-trips-create-place-choice]");

      if (!placeCard || !root.contains(placeCard)) {
        return;
      }

      setTripsCreatePlaceChoice(placeCard.dataset.tripsCreatePlaceChoice);
    });

    setTripsCreatePlaceChoice("water");

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
    publishDebug();
  }

  function open() {
    ensureOverlay();
    isOpen = true;
    step = 1;
    tripDraft = { ...DEFAULT_DRAFT };
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
