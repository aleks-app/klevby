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
        <button type="button" class="trips-create-flow__place-card" data-trips-create-place-choice="water" aria-label="Выбрать водоём">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--water">
              <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                <path d="M5 30.6966C5.84516 30.54 6.50323 30.1241 6.97421 29.4489C7.44628 28.7753 8.33821 27.4437 9.65 27.4437C11.0249 27.4437 11.9951 28.8462 12.5607 29.6617C13.1264 30.4772 13.9612 30.8849 15.0652 30.8849C16.1823 30.8849 17.0236 30.4772 17.5893 29.6617C18.1549 28.8462 19.1251 27.4437 20.5 27.4437C21.8618 27.4437 22.8321 28.8462 23.4107 29.6617C23.9894 30.4772 24.8308 30.8849 25.9348 30.8849C27.0519 30.8849 27.89 30.4772 28.4491 29.6617C29.0092 28.8462 29.9762 27.4437 31.35 27.4437C32.6618 27.4437 33.5537 28.7761 34.0258 29.4513C34.4968 30.1249 35.1548 30.5408 36 30.699M5 21.4784C5.84516 21.3218 6.50323 20.9059 6.97421 20.2307C7.44628 19.5571 8.33821 18.2255 9.65 18.2255C11.0118 18.2255 11.9788 19.628 12.5509 20.4435C13.1231 21.259 13.9612 21.6667 15.0652 21.6667C16.1823 21.6667 17.0236 21.259 17.5893 20.4435C18.1549 19.628 19.1251 18.2247 20.5 18.2231C21.8618 18.2231 22.8299 19.6256 23.4042 20.4411C23.9785 21.2566 24.8161 21.6643 25.9168 21.6643C27.0328 21.6643 27.8736 21.2566 28.4393 20.4411C29.0049 19.6256 29.9751 18.2231 31.35 18.2231C32.6487 18.2231 33.5407 19.5555 34.0258 20.2307C34.5098 20.9043 35.1679 21.3194 36 21.4759M5 12.2553C5.84516 12.0987 6.50323 11.6828 6.97421 11.0076C7.44628 10.334 8.33821 9.00245 9.65 9.00245C11.0118 9.00245 11.9788 10.405 12.5509 11.2204C13.1231 12.0359 13.9612 12.4437 15.0652 12.4437C16.1823 12.4437 17.0236 12.0359 17.5893 11.2204C18.1549 10.405 19.1251 9.00163 20.5 9C21.8618 9 22.8299 10.4025 23.4042 11.218C23.9785 12.0335 24.8161 12.4412 25.9168 12.4412C27.0328 12.4412 27.8736 12.0335 28.4393 11.218C29.0049 10.4025 29.9751 9 31.35 9C32.6487 9 33.5407 10.3316 34.0258 11.0051C34.5098 11.6804 35.1679 12.0963 36 12.2528" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
          </span>
          <span class="trips-create-flow__place-copy">
            <span class="trips-create-flow__place-title">Выбрать водоём</span>
            <span class="trips-create-flow__place-note">Из базы водоёмов</span>
          </span>
        </button>
        <button type="button" class="trips-create-flow__place-card" data-trips-create-place-choice="map" aria-label="Указать на карте">
          <span class="trips-create-flow__place-icon-shell" aria-hidden="true">
            <span class="trips-create-flow__place-icon trips-create-flow__place-icon--map">
              <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                <path d="M24.9998 33.2049L14.9998 29.7049L8.40317 32.2549C7.9765 32.4138 7.58039 32.3677 7.21484 32.1166C6.84928 31.8655 6.6665 31.5121 6.6665 31.0566V10.6733C6.6665 10.3755 6.73873 10.1038 6.88317 9.85826C7.02762 9.6127 7.23761 9.44214 7.51317 9.34659L14.9998 6.79492L24.9998 10.2949L31.5965 7.74492C32.0232 7.58603 32.4193 7.61603 32.7848 7.83492C33.1504 8.05381 33.3332 8.38048 33.3332 8.81492V29.4549C33.3332 29.7738 33.2448 30.0505 33.0682 30.2849C32.8926 30.5205 32.656 30.686 32.3582 30.7816L24.9998 33.2049ZM24.1665 31.1716V11.6716L15.8332 8.76325V28.2633L24.1665 31.1716ZM25.8332 31.1716L31.6665 29.2499V9.49992L25.8332 11.6733V31.1716ZM8.33317 30.4999L14.1665 28.2633V8.76325L8.33317 10.7499V30.4999Z" fill="currentColor"/>
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
        card.classList.remove("is-pressing");
      });
    };

    root.addEventListener("click", (event) => {
      const placeCard = event.target.closest("[data-trips-create-place-choice]");
      if (!placeCard || !root.contains(placeCard)) return;

      syncPlaceCards();
      publishDebug();
    });

    syncPlaceCards();

    const tripsCreatePlaceFlashOnly = (pressedCard) => {
      root.querySelectorAll("[data-trips-create-place-choice]").forEach((card) => {
        card.classList.remove("is-pressing");
      });

      pressedCard.classList.add("is-pressing");

      window.setTimeout(() => {
        pressedCard.classList.remove("is-pressing");
      }, 180);
    };

    root.querySelectorAll("[data-trips-create-place-choice]").forEach((card) => {
      card.classList.remove("is-pressing");
    });

    root.addEventListener("click", (event) => {
      const placeCard = event.target.closest("[data-trips-create-place-choice]");

      if (!placeCard || !root.contains(placeCard)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      tripsCreatePlaceFlashOnly(placeCard);
    }, true);

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
        card.classList.remove("is-pressing");
      });
    }
    publishDebug();
  }

  function open() {
    ensureOverlay();
    isOpen = true;
    step = 1;
    tripDraft = { ...DEFAULT_DRAFT };
    tripDraft.destination = "";
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
