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
  let progressNode = null;
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
        <h3 id="tripsCreateStep1Title" class="trips-create-flow__copy-title">
          <span class="trips-create-flow__copy-title-line">Куда планируете</span>
          <span class="trips-create-flow__copy-title-line">выезд?</span>
        </h3>
        <p class="trips-create-flow__copy-subtitle">
          <span class="trips-create-flow__copy-subtitle-line">Выберите водоём или укажите место</span>
          <span class="trips-create-flow__copy-subtitle-line">на карте, где планируете рыбачить.</span>
        </p>
      </div>
      <div class="trips-create-flow__choices" role="list" aria-label="Способ выбора места выезда"></div>
      <div class="trips-create-flow__panel" role="dialog" aria-modal="true" aria-labelledby="tripsCreateFlowTitle">
        <header class="trips-create-flow__header">
          <div class="trips-create-flow__header-skeleton">
            <p class="trips-create-flow__eyebrow">Новый выезд</p>
            <h2 id="tripsCreateFlowTitle" class="trips-create-flow__title"></h2>
          </div>
          <div class="trips-create-flow__header-destination">
            <button class="trips-create-flow__back" type="button" data-trips-create-action="back" aria-label="Назад">
              <span class="trips-create-flow__back-icon" aria-hidden="true">
                <img src="assets/icons/ui/chevron-left.svg" alt="" decoding="async" />
              </span>
            </button>
            <span class="trips-create-flow__progress" aria-live="polite"></span>
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
    progressNode = root.querySelector(".trips-create-flow__progress");
    nextButton = root.querySelector('[data-trips-create-action="next"]');

    STEPS.forEach((label, index) => {
      const slide = document.createElement("section");
      slide.className = "trips-create-flow__step";
      slide.setAttribute("data-trips-create-slide", String(index + 1));
      if (index === 0) {
        slide.classList.add("trips-create-flow__step--destination");
      } else {
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
    overlay.querySelector(".trips-create-flow__panel")?.setAttribute(
      "aria-labelledby",
      step === 1 ? "tripsCreateStep1Title" : "tripsCreateFlowTitle"
    );
    titleNode.textContent = STEPS[step - 1];
    const progressText = `${step} / ${TOTAL_STEPS}`;
    counterNode.textContent = progressText;
    if (progressNode) progressNode.textContent = progressText;
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
