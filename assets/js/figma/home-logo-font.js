(() => {
  const STYLE_ID = "klevgo-home-logo-font-style";

  function isHomeVisible() {
    const text = document.body?.innerText || "";
    return text.includes("Соцсеть") && text.includes("рыбаков");
  }

  function findLogoElement() {
    const candidates = Array.from(document.querySelectorAll("body *"));
    return candidates.find((el) => {
      const text = (el.textContent || "").trim().replace(/\s+/g, "");
      if (text !== "KlevGo") return false;

      const rect = el.getBoundingClientRect();
      return rect.width > 20 && rect.width < 140 && rect.height > 10 && rect.height < 70;
    });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .klevgo-home-figma-logo-font,
      .klevgo-home-figma-logo-font * {
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        font-size: 22px !important;
        font-weight: 600 !important;
        line-height: 40px !important;
        letter-spacing: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncLogoFont() {
    if (!isHomeVisible()) return;

    ensureStyle();

    const logo = findLogoElement();
    if (!logo) return;

    logo.classList.add("klevgo-home-figma-logo-font");
  }

  syncLogoFont();

  const observer = new MutationObserver(syncLogoFont);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("pageshow", syncLogoFont);
  window.addEventListener("resize", syncLogoFont);
})();
