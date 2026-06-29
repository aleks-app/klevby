(function () {
  "use strict";

  const STYLE_ID = "klevby-last-known-ui-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .klevby-last-known-notice {
        box-sizing: border-box;
        margin: 0 0 10px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 141, 40, 0.28);
        background: rgba(18, 24, 27, 0.92);
        color: #fff8ea;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.35;
      }

      .klevby-last-known-notice strong {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 2px;
      }

      .klevby-last-known-notice--compact {
        margin-bottom: 8px;
        padding: 8px 10px;
        font-size: 11px;
      }

      .klevby-last-known-empty {
        box-sizing: border-box;
        padding: 18px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 141, 40, 0.22);
        background: rgba(18, 24, 27, 0.9);
        color: #fff8ea;
        text-align: left;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .klevby-last-known-empty h3 {
        margin: 0 0 6px;
        font-size: 16px;
        line-height: 1.2;
      }

      .klevby-last-known-empty p {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        color: rgba(255, 248, 234, 0.84);
      }

      #homeSection .klevby-last-known-home-notice {
        position: fixed;
        left: var(--klevby-home-content-inset, 22px);
        right: var(--klevby-home-content-inset, 22px);
        z-index: 2147479000;
        pointer-events: none;
      }

      #feedSection .klevby-last-known-notice,
      #tripsSection .klevby-last-known-notice {
        width: min(100%, 408px);
        margin-left: auto;
        margin-right: auto;
      }

      #tripsSection .trips-fullscreen-trip-card {
        box-sizing: border-box;
        width: min(100%, 408px);
        margin: 0 auto 10px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(88, 108, 124, 0.28);
        background: rgba(12, 18, 22, 0.72);
        color: rgba(245, 248, 252, 0.94);
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #tripsSection .trips-fullscreen-trip-card h4 {
        margin: 0 0 6px;
        font-size: 15px;
        line-height: 1.2;
      }

      #tripsSection .trips-fullscreen-trip-card p {
        margin: 0 0 4px;
        font-size: 12px;
        line-height: 1.35;
        color: rgba(245, 248, 252, 0.78);
      }

      #tripsSection .trips-fullscreen-trip-card-meta {
        margin-top: 8px;
        font-size: 11px;
        color: rgba(244, 122, 43, 0.82);
      }
    `;
    document.head.appendChild(style);
  }

  function savedNoticeHtml(options = {}) {
    ensureStyle();
    const compact = Boolean(options.compact);
    const title = options.title || "Последние сохранённые данные";
    const subtitle = options.subtitle || "Обновятся, когда появится интернет";

    return `
      <div class="klevby-last-known-notice${compact ? " klevby-last-known-notice--compact" : ""}" role="status" aria-live="polite">
        <strong>${title}</strong>
        <span>${subtitle}</span>
      </div>
    `;
  }

  function feedSavedNoticeHtml() {
    return savedNoticeHtml({
      title: "Сохранённая лента",
      subtitle: "Обновится, когда появится интернет",
      compact: true,
    });
  }

  function offlineEmptyHtml(options = {}) {
    ensureStyle();
    const title = options.title || "Нет интернета";
    const message =
      options.message ||
      "Откройте приложение один раз с интернетом, чтобы сохранить данные для быстрого запуска";

    return `
      <div class="klevby-last-known-empty">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;
  }

  function tripsOfflineEmptyHtml() {
    return offlineEmptyHtml({
      title: "Нет интернета",
      message:
        "Откройте приложение один раз с интернетом, чтобы сохранить выезды для быстрого просмотра офлайн.",
    });
  }

  window.KlevbyLastKnownUi = {
    ensureStyle,
    savedNoticeHtml,
    feedSavedNoticeHtml,
    offlineEmptyHtml,
    tripsOfflineEmptyHtml,
  };
})();
