(function () {
  "use strict";

  const MODAL_STYLES_ID = "klevbyFeedModalStyles";
  const MODAL_STYLES_VERSION = "20260509-feed-modal-styles-split-1";

  function ensureModalStyles() {
    const oldStyle = document.getElementById(MODAL_STYLES_ID);

    if (oldStyle && oldStyle.dataset.version === MODAL_STYLES_VERSION) {
      return oldStyle;
    }

    if (oldStyle) {
      oldStyle.remove();
    }

    const style = document.createElement("style");
    style.id = MODAL_STYLES_ID;
    style.dataset.version = MODAL_STYLES_VERSION;

    style.textContent = `
      .klevby-feed-viewer.hidden,
      .klevby-feed-comment-modal.hidden {
        display: none !important;
      }

      .klevby-feed-viewer,
      .klevby-feed-comment-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding:
          max(18px, env(safe-area-inset-top))
          14px
          max(18px, env(safe-area-inset-bottom));
      }

      .klevby-feed-comment-modal {
        z-index: 100000;
      }

      .klevby-feed-viewer-backdrop,
      .klevby-feed-comment-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .klevby-feed-viewer-sheet,
      .klevby-feed-comment-sheet {
        position: relative;
        z-index: 2;
        width: min(100%, 760px);
        max-height: 88dvh;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 28px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(244,178,74,0.12), transparent 42%),
          rgba(10, 14, 12, 0.96);
        box-shadow:
          0 28px 90px rgba(0,0,0,0.72),
          inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .klevby-feed-viewer-close,
      .klevby-feed-comment-close {
        appearance: none;
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 3;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 16px;
        background: rgba(0,0,0,0.45);
        color: #fff8ea;
        font-size: 28px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .klevby-feed-viewer-image {
        width: 100%;
        max-height: 66dvh;
        display: block;
        object-fit: contain;
        background: #050807;
      }

      .klevby-feed-viewer-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        color: #fff8ea;
      }

      .klevby-feed-viewer-info strong {
        display: block;
        font-size: 15px;
        font-weight: 900;
        line-height: 1.25;
      }

      .klevby-feed-viewer-info span {
        display: block;
        margin-top: 4px;
        color: rgba(255,248,234,0.55);
        font-size: 12px;
        font-weight: 700;
      }

      .klevby-feed-viewer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .klevby-feed-viewer-actions button {
        appearance: none;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 15px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        transform: translateY(0) scale(1);
        transition:
          transform 0.08s ease,
          filter 0.12s ease,
          box-shadow 0.12s ease,
          background 0.12s ease,
          opacity 0.12s ease;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .klevby-feed-viewer-close,
      .klevby-feed-comment-close,
      .klevby-feed-comment-delete,
      .klevby-feed-comment-actions .small-btn {
        transform: translateY(0) scale(1);
        transition:
          transform 0.08s ease,
          filter 0.12s ease,
          box-shadow 0.12s ease,
          background 0.12s ease,
          opacity 0.12s ease;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .klevby-feed-viewer-actions button:hover,
      .klevby-feed-viewer-close:hover,
      .klevby-feed-comment-close:hover,
      .klevby-feed-comment-delete:hover,
      .klevby-feed-comment-actions .small-btn:hover {
        filter: brightness(1.08);
      }

      .klevby-feed-viewer-actions button:active,
      .klevby-feed-viewer-actions button.is-pressed,
      .klevby-feed-viewer-close:active,
      .klevby-feed-viewer-close.is-pressed,
      .klevby-feed-comment-close:active,
      .klevby-feed-comment-close.is-pressed,
      .klevby-feed-comment-delete:active,
      .klevby-feed-comment-delete.is-pressed,
      .klevby-feed-comment-actions .small-btn:active,
      .klevby-feed-comment-actions .small-btn.is-pressed {
        transform: translateY(2px) scale(0.97);
        filter: brightness(1.16);
        box-shadow:
          inset 0 2px 8px rgba(0,0,0,0.35),
          0 0 0 1px rgba(255,255,255,0.08);
      }

      .klevby-feed-viewer-actions button.is-pending,
      .klevby-feed-viewer-actions button:disabled {
        opacity: 0.72;
        cursor: wait;
      }

      #klevbyFeedViewerLikeBtn,
      #klevbyFeedViewerCommentBtn {
        border: 1px solid rgba(244,178,74,0.20);
        background: rgba(244,178,74,0.18);
        color: #fff8ea !important;
      }

      #klevbyFeedViewerLikeBtn.is-liked,
      #klevbyFeedViewerLikeBtn.liked {
        border-color: rgba(255,190,76,0.48);
        background:
          linear-gradient(180deg, rgba(255,190,76,0.34), rgba(244,178,74,0.18));
        color: #fff8ea !important;
      }

      #klevbyFeedViewerDeleteBtn {
        border: 1px solid rgba(228,88,88,0.24);
        background: rgba(228,88,88,0.92);
      }

      #klevbyFeedViewerDeleteBtn.hidden,
      #klevbyFeedViewerLikeBtn.hidden,
      #klevbyFeedViewerCommentBtn.hidden {
        display: none !important;
      }

      .klevby-feed-comment-sheet {
        width: min(100%, 620px);
        max-height: min(82dvh, 720px);
        padding: 22px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .klevby-feed-comment-sheet h3 {
        margin: 0 52px 8px 0;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.18;
        font-weight: 900;
      }

      .klevby-feed-comment-sheet p {
        margin: 0 0 14px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comments-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 260px;
        overflow-y: auto;
        margin: 0 0 14px;
        padding: 4px 2px 2px;
        -webkit-overflow-scrolling: touch;
      }

      .klevby-feed-comment-item {
        padding: 12px;
        border-radius: 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(244,178,74,0.11);
      }

      .klevby-feed-comment-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 7px;
      }

      .klevby-feed-comment-author {
        display: block;
        color: #fff8ea;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 900;
      }

      .klevby-feed-comment-date {
        display: block;
        margin-top: 2px;
        color: rgba(255,248,234,0.45);
        font-size: 11px;
        line-height: 1.2;
        font-weight: 700;
      }

      .klevby-feed-comment-delete {
        appearance: none;
        border: 1px solid rgba(228,88,88,0.22);
        background: rgba(228,88,88,0.12);
        color: #ffd2d2;
        border-radius: 999px;
        min-height: 28px;
        padding: 0 10px;
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        flex: 0 0 auto;
      }

      .klevby-feed-comment-text {
        margin: 0;
        color: rgba(255,248,234,0.82);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .klevby-feed-comments-empty {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.045);
        border: 1px dashed rgba(244,178,74,0.16);
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 700;
      }

      .klevby-feed-comment-textarea {
        width: 100%;
        min-height: 104px;
        resize: vertical;
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(244,178,74,0.16);
        outline: none;
        background: rgba(255,255,255,0.07);
        color: #fff8ea;
        font: inherit;
        font-size: 15px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comment-textarea::placeholder {
        color: rgba(255,248,234,0.42);
      }

      .klevby-feed-comment-actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }

      .klevby-feed-comment-actions .small-btn {
        flex: 1;
      }

      .klevby-feed-comment-message {
        min-height: 22px;
        margin-top: 12px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
      }

      .klevby-feed-comment-message.error-line {
        color: #ffd2d2;
        background: transparent;
        border: 0;
        padding: 0;
        box-shadow: none;
      }

      @media (max-width: 760px) {
        .klevby-feed-comment-modal {
          align-items: center !important;
          justify-content: center !important;
          padding:
            max(18px, env(safe-area-inset-top))
            12px
            max(18px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-feed-comment-sheet {
          border-radius: 24px;
          padding: 20px;
          max-height: 78dvh;
        }

        .klevby-feed-comments-list {
          max-height: 230px;
        }

        .klevby-feed-comment-textarea {
          min-height: 96px;
        }

        .klevby-feed-viewer {
          align-items: center;
          padding: 12px;
        }

        .klevby-feed-viewer-sheet {
          border-radius: 24px;
          max-height: 86dvh;
        }

        .klevby-feed-viewer-image {
          max-height: 58dvh;
        }

        .klevby-feed-viewer-info {
          align-items: flex-start;
          flex-direction: column;
        }

        .klevby-feed-viewer-actions {
          width: 100%;
          justify-content: stretch;
        }

        .klevby-feed-viewer-actions button {
          flex: 1;
        }
      }

      @media (max-width: 380px) {
        .klevby-feed-comments-list {
          max-height: 200px;
        }
      }
    `;

    document.body.appendChild(style);

    return style;
  }

  window.KlevbyFeedModalStyles = {
    ensureModalStyles
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureModalStyles);
  } else {
    ensureModalStyles();
  }
})();
