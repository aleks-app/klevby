(() => {
  const SLOT_ID = "klevgo-home-figma-empty-ad-shell";
  const FEED_TITLE_ID = "klevgo-home-figma-feed-title";
  const FEED_VIEW_ALL_ID = "klevgo-home-figma-feed-view-all";
  const STYLE_ID = "klevgo-home-figma-empty-ad-shell-style";
  const STARTED_AT = performance.now();

  function leftFromFigma(x) {
    return `max(${x}px, calc((100vw - 440px) / 2 + ${x}px))`;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${SLOT_ID} {
        position: fixed;
        left: ${leftFromFigma(23)};
        top: 505px;
        width: 396px;
        height: 243px;
        box-sizing: border-box;
        border-radius: 16px;
        background: #161C20;
        border: 0.9px solid rgba(255, 255, 255, 0.14);
        box-shadow: none;
        overflow: hidden;
        z-index: 2147480000;
        pointer-events: none;
      }

      #${SLOT_ID}::before,
      #${SLOT_ID}::after {
        content: none !important;
        display: none !important;
      }

      #${FEED_TITLE_ID} {
        position: fixed;
        left: ${leftFromFigma(23)};
        top: 469px;
        width: 55px;
        height: 24px;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 19px;
        font-weight: 500;
        line-height: 24px;
        letter-spacing: 0;
        color: #FFFFFF;
        white-space: nowrap;
        z-index: 2147480001;
        pointer-events: none;
      }

      #${FEED_VIEW_ALL_ID} {
        position: fixed;
        left: ${leftFromFigma(309)};
        top: 469px;
        width: 110px;
        height: 23px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        font-weight: 400;
        line-height: 21px;
        letter-spacing: 0;
        color: #FFFFFF;
        white-space: nowrap;
        z-index: 2147480001;
        pointer-events: none;
      }

      #${FEED_VIEW_ALL_ID} img {
        width: 8px;
        height: 14px;
        display: block;
        flex: 0 0 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function isHomeVisible() {
    // Splash/startup screen must stay clean. Figma mirror elements appear only after real Home is visible.
    if (performance.now() - STARTED_AT < 2800) return false;

    const visibleTextNodes = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const text = (el.textContent || "").trim();
      if (!text) return false;

      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 8) return false;

      return rect.top > 100 && rect.top < window.innerHeight - 80;
    });

    const hasHero = visibleTextNodes.some((el) => {
      const text = (el.textContent || "").trim();
      return text.includes("Соцсеть") || text.includes("рыбаков");
    });

    const hasHomeFeed = visibleTextNodes.some((el) => {
      const text = (el.textContent || "").trim();
      return text.includes("Лента");
    });

    return hasHero && hasHomeFeed;
  }

  function ensureHomeFigmaElements() {
    ensureStyle();

    let slot = document.getElementById(SLOT_ID);
    if (!slot) {
      slot = document.createElement("div");
      slot.id = SLOT_ID;
      slot.setAttribute("aria-hidden", "true");
      document.body.appendChild(slot);
    }

    let feedTitle = document.getElementById(FEED_TITLE_ID);
    if (!feedTitle) {
      feedTitle = document.createElement("div");
      feedTitle.id = FEED_TITLE_ID;
      feedTitle.setAttribute("aria-hidden", "true");
      feedTitle.textContent = "Лента";
      document.body.appendChild(feedTitle);
    }

    let feedViewAll = document.getElementById(FEED_VIEW_ALL_ID);
    if (!feedViewAll) {
      feedViewAll = document.createElement("div");
      feedViewAll.id = FEED_VIEW_ALL_ID;
      feedViewAll.setAttribute("aria-hidden", "true");
      feedViewAll.innerHTML = '<span>Смотреть всё</span><img src="/assets/icons/figma/home-feed-view-all-chevron.svg" alt="" aria-hidden="true" />';
      document.body.appendChild(feedViewAll);
    }
  }

  function removeHomeFigmaElements() {
    document.getElementById(SLOT_ID)?.remove();
    document.getElementById(FEED_TITLE_ID)?.remove();
    document.getElementById(FEED_VIEW_ALL_ID)?.remove();
  }

  function sync() {
    if (isHomeVisible()) {
      ensureHomeFigmaElements();
    } else {
      removeHomeFigmaElements();
    }
  }

  sync();
  window.setTimeout(sync, 3000);
  window.setTimeout(sync, 3800);

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("pageshow", sync);
  window.addEventListener("resize", sync);
})();
