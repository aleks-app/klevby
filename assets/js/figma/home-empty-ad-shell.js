(() => {
  const SLOT_ID = "klevgo-home-figma-empty-ad-shell";
  const FEED_TITLE_ID = "klevgo-home-figma-feed-title";
  const STYLE_ID = "klevgo-home-figma-empty-ad-shell-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${SLOT_ID} {
        position: fixed;
        left: max(23px, calc((100vw - 440px) / 2 + 23px));
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
        left: max(23px, calc((100vw - 440px) / 2 + 23px));
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

      #${FEED_TITLE_ID}::before,
      #${FEED_TITLE_ID}::after {
        content: none !important;
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isHomeVisible() {
    const text = document.body?.innerText || "";
    return text.includes("Соцсеть") && text.includes("рыбаков") && text.includes("Лента");
  }

  function ensureSlot() {
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
  }

  function removeSlot() {
    const slot = document.getElementById(SLOT_ID);
    if (slot) slot.remove();

    const feedTitle = document.getElementById(FEED_TITLE_ID);
    if (feedTitle) feedTitle.remove();
  }

  function sync() {
    if (isHomeVisible()) {
      ensureSlot();
    } else {
      removeSlot();
    }
  }

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("pageshow", sync);
  window.addEventListener("resize", sync);
})();
