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
  );

  let isOpen = false;
  let step = 1;
  let tripDraft = { ...DEFAULT_DRAFT };
  let overlay = null;
  let placeLayout = null;
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

  function buildProgressBarsMarkup(activeStep) {
    return Array.from({ length: TOTAL_STEPS }, (_, index) => {
      const stepNumber = index + 1;
      const stateClass = stepNumber < activeStep
        ? "is-complete"
        : stepNumber === activeStep
          ? "is-active"
          : "";
      return `<span class="trips-create-flow-step--place__progress-bar ${stateClass}"></span>`;
    }).join("");
  }

  function buildPlaceStepLayout() {
    return `
      <section class="trips-create-flow-step--place" aria-labelledby="tripsCreateStep1Title">
        <header class="trips-create-flow-step--place__top">
          <button class="trips-create-flow-step--place__back" type="button" data-trips-create-action="back" aria-label="Назад">
            <span class="trips-create-flow-step--place__back-icon" aria-hidden="true">
              <img src="assets/icons/ui/chevron-left.svg" alt="" decoding="async" />
            </span>
          </button>
          <div class="trips-create-flow-step--place__progress" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL_STEPS}" aria-valuenow="1" aria-label="Прогресс создания выезда">
            ${buildProgressBarsMarkup(1)}
          </div>
        </header>

        <div class="trips-create-flow-step--place__copy">
          <h1 id="tripsCreateStep1Title" class="trips-create-flow-step--place__title">
            <span>Куда планируете</span>
            <span>выезд?</span>
          </h1>
          <p class="trips-create-flow-step--place__subtitle">
            <span>Выберите водоём или укажите место</span>
            <span>на карте, где планируете рыбачить.</span>
          </p>
        </div>

        <div class="trips-create-flow-step--place__choices" role="list" aria-label="Способ выбора места выезда">
          <button class="trips-create-flow-step--place__choice" type="button" role="listitem" data-trips-create-destination="water-body">
            <span class="trips-create-flow-step--place__choice-title">Водоём</span>
            <span class="trips-create-flow-step--place__choice-note">Выбрать из каталога</span>
          </button>
          <button class="trips-create-flow-step--place__choice" type="button" role="listitem" data-trips-create-destination="map-point">
            <span class="trips-create-flow-step--place__choice-title">Точка на карте</span>
            <span class="trips-create-flow-step--place__choice-note">Указать место вручную</span>
          </button>
        </div>

        <div class="trips-create-flow-step--place__next-wrap">
          <button class="trips-create-flow-step--place__next" type="button" data-trips-create-action="next" aria-label="Далее">
            <span class="trips-create-flow-step--place__next-icon" aria-hidden="true">
              <img src="assets/icons/weather/chevron-right-orange.svg" alt="" decoding="async" />
            </span>
            <span class="trips-create-flow-step--place__next-label">Далее</span>
          </button>
        </div>
      </section>
    `;
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.className = "trips-create-flow";
    root.setAttribute("data-trips-create-flow", "closed");
    root.setAttribute("data-trips-create-step", "1");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      ${buildPlaceStepLayout()}
      <div class="trips-create-flow__panel" role="dialog" aria-modal="true" aria-labelledby="tripsCreateFlowTitle">
        <header class="trips-create-flow__header">
          <div class="trips-create-flow__header-skeleton">
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

    placeLayout = root.querySelector(".trips-create-flow-step--place");
    track = root.querySelector(".trips-create-flow__track");
    titleNode = root.querySelector(".trips-create-flow__title");
    counterNode = root.querySelector(".trips-create-flow__counter");
    nextButton = root.querySelector(".trips-create-flow__panel .trips-create-flow__nav--next");

    STEPS.forEach((label, index) => {
      if (index === 0) return;

      const slide = document.createElement("section");
      slide.className = "trips-create-flow__step";
      slide.setAttribute("data-trips-create-slide", String(index + 1));
      slide.innerHTML = `
        <p class="trips-create-flow__step-kicker">Шаг ${index + 1} из ${TOTAL_STEPS}</p>
        <h3 class="trips-create-flow__step-title">${label}</h3>
        <p class="trips-create-flow__step-note">Поля появятся в следующих PR. Сейчас сохраняем единый draft-state и навигацию flow.</p>
      `;
      track.appendChild(slide);
    });

    root.addEventListener("click", (event) => {
      const action = event.target?.closest?.("[data-trips-create-action]")?.getAttribute("data-trips-create-action");
      if (!action) return;
      if (action === "close") close();
      if (action === "back") back();
      if (action === "next") next();
    });

    return root;
  }

  function ensureOverlay() {
    if (overlay && overlay.isConnected) return overlay;
    overlay = buildOverlay();
    const tripsSection = getTripsSection();
    (tripsSection || document.body).appendChild(overlay);
    return overlay;
  }

  function renderPlaceProgress(activeStep) {
    if (!placeLayout) return;
    const progress = placeLayout.querySelector(".trips-create-flow-step--place__progress");
    if (!progress) return;
    progress.setAttribute("aria-valuenow", String(activeStep));
    progress.innerHTML = buildProgressBarsMarkup(activeStep);
  }

  function render() {
    ensureOverlay();
    const isPlaceStep = step === 1;

    overlay.setAttribute("data-trips-create-flow", isOpen ? "open" : "closed");
    overlay.setAttribute("data-trips-create-step", String(step));
    overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    overlay.classList.toggle("trips-create-flow--place-step", isPlaceStep);

    if (isPlaceStep) {
      renderPlaceProgress(step);
    } else {
      titleNode.textContent = STEPS[step - 1];
      counterNode.textContent = `${step} / ${TOTAL_STEPS}`;
      track.style.transform = `translateX(-${(step - 2) * 100}%)`;
      nextButton.textContent = step === TOTAL_STEPS ? "Публикация позже" : "Далее";
      nextButton.disabled = step === TOTAL_STEPS;
      overlay.querySelector(".trips-create-flow__panel")?.setAttribute("aria-labelledby", "tripsCreateFlowTitle");
    }

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
