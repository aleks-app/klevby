(function () {
  const FEED_STYLES_VERSION = "20260510-feed-like-tap-flash-1";

  function getMountNode() {
    return document.head || document.body || document.documentElement;
  }

  function ensureFeedStyles(options = {}) {
    const oldStyle = document.getElementById("klevbyFeedStyles");

    if (oldStyle && oldStyle.dataset.version === FEED_STYLES_VERSION) {
      return true;
    }

    if (oldStyle) {
      oldStyle.remove();
    }

    const mountNode = getMountNode();

    if (!mountNode) {
      return false;
    }

    const style = document.createElement("style");
    style.id = "klevbyFeedStyles";
    style.dataset.version = FEED_STYLES_VERSION;

    style.textContent = `
      @media (max-width: 760px) {
        html.klevby-feed-mobile-lock,
        html.klevby-feed-mobile-lock body,
        body.klevby-feed-mobile-lock {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          overscroll-behavior-x: none !important;
          box-sizing: border-box !important;
        }

        html.klevby-feed-mobile-lock *,
        html.klevby-feed-mobile-lock *::before,
        html.klevby-feed-mobile-lock *::after {
          box-sizing: border-box;
        }

        html.klevby-feed-mobile-lock #homeSection,
        html.klevby-feed-mobile-lock #profileFeedSection,
        html.klevby-feed-mobile-lock .social-feed-grid {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
          overscroll-behavior-x: none !important;
        }

        html.klevby-feed-mobile-lock .profile-feed-card {
          width: 100% !important;
          max-width: calc(100vw - 24px) !important;
          min-width: 0 !important;
          margin-left: auto !important;
          margin-right: auto !important;
          box-sizing: border-box !important;
        }

        html.klevby-feed-mobile-lock .profile-feed-image,
        html.klevby-feed-mobile-lock .profile-feed-body,
        html.klevby-feed-mobile-lock .profile-feed-author,
        html.klevby-feed-mobile-lock .profile-feed-author-text,
        html.klevby-feed-mobile-lock .profile-feed-title,
        html.klevby-feed-mobile-lock .profile-feed-tags,
        html.klevby-feed-mobile-lock .profile-feed-actions {
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }

        html.klevby-feed-mobile-lock .profile-feed-title,
        html.klevby-feed-mobile-lock .profile-feed-author-name,
        html.klevby-feed-mobile-lock .profile-feed-author-action,
        html.klevby-feed-mobile-lock .trip-name,
        html.klevby-feed-mobile-lock .trip-destination {
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }

        html.klevby-feed-mobile-lock .profile-feed-actions {
          width: 100% !important;
        }

        html.klevby-feed-mobile-lock .profile-feed-actions .small-btn {
          min-width: 0 !important;
        }
      }

      .social-feed-grid {
        align-items: start;
      }

      .profile-feed-card {
        position: relative;
        overflow: hidden;
        width: min(100%, 620px);
        padding: 0 !important;
        border-radius: 28px !important;
        border: 1px solid rgba(244, 178, 74, 0.18) !important;
        background:
          radial-gradient(circle at 20% 0%, rgba(244, 178, 74, 0.10), transparent 38%),
          rgba(12, 21, 17, 0.94) !important;
        box-shadow:
          0 22px 62px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        cursor: default;
        transform: none !important;
      }

      .profile-feed-card:hover,
      .profile-feed-card:focus,
      .profile-feed-card:focus-within,
      .profile-feed-card:active {
        transform: none !important;
        filter: none !important;
      }

      .profile-feed-image {
        position: relative;
        overflow: hidden;
        width: 100% !important;
        min-height: 300px !important;
        height: clamp(300px, 38vw, 430px) !important;
        max-height: 430px !important;
        border-radius: 28px 28px 0 0 !important;
        background-color: #07100d !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        box-shadow: inset 0 -80px 100px rgba(0,0,0,0.18);
      }

      .profile-feed-image::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.20));
      }

      .profile-feed-image-img {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        border: 0;
        opacity: 1;
        transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        user-select: none;
        -webkit-user-select: none;
        pointer-events: none;
      }

      .profile-feed-body {
        padding: 14px 16px 16px !important;
      }

      .profile-feed-avatar-img,
      .profile-feed-avatar-fallback {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        display: inline-flex;
        flex: 0 0 auto;
        border: 1px solid rgba(244,178,74,0.34);
        box-shadow: 0 12px 28px rgba(0,0,0,0.32);
      }

      .profile-feed-avatar-img {
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }

      .profile-feed-avatar-fallback {
        align-items: center;
        justify-content: center;
        background: rgba(244,178,74,0.16);
        color: #fff8ea;
        font-weight: 900;
      }

      .profile-feed-author {
        appearance: none;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 0;
        margin: 0 0 12px;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .profile-feed-author:hover .profile-feed-author-name,
      .profile-feed-author:focus-visible .profile-feed-author-name {
        color: #ffbd4a;
      }

      .profile-feed-author-text {
        min-width: 0;
        display: block;
      }

      .profile-feed-author-name {
        display: block;
        font-size: 15px;
        font-weight: 950;
        line-height: 1.12;
        color: #fff8ea;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color 0.16s ease;
      }

      .profile-feed-author-action {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,248,234,0.56);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-feed-title {
        margin: 0 0 12px !important;
        color: #fff8ea !important;
        font-size: clamp(19px, 3.8vw, 26px) !important;
        line-height: 1.12 !important;
        font-weight: 950 !important;
        letter-spacing: -0.028em;
      }

      .profile-feed-title .trip-name {
        color: #ffb43e !important;
        text-shadow: 0 12px 32px rgba(255, 171, 48, 0.16);
      }

      .profile-feed-title .trip-destination {
        color: #fff8ea !important;
      }

      .profile-feed-tags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
        margin: 0 0 12px !important;
      }

      .profile-feed-tags .tag {
        min-height: 32px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid rgba(244,178,74,0.16);
        background: rgba(255,255,255,0.065);
        color: rgba(255,248,234,0.82);
        font-size: 12px;
        line-height: 1;
        font-weight: 900;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .profile-feed-actions {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        align-items: stretch !important;
        gap: 10px !important;
        margin-top: 0 !important;
      }

      .profile-feed-actions .small-btn {
        appearance: none !important;
        min-width: 0 !important;
        width: 100% !important;
        height: 48px !important;
        min-height: 48px !important;
        max-height: 48px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        padding: 0 10px !important;
        border-radius: 18px !important;
        border: 1px solid rgba(244, 178, 74, 0.22) !important;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.045)),
          rgba(18, 28, 23, 0.86) !important;
        color: rgba(255, 248, 234, 0.94) !important;
        font-size: 14px !important;
        line-height: 1 !important;
        font-weight: 950 !important;
        letter-spacing: -0.01em !important;
        text-align: center !important;
        white-space: nowrap !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.055),
          0 10px 22px rgba(0, 0, 0, 0.18) !important;
        cursor: pointer !important;
        transform: translateZ(0) !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        transition:
          background 0.16s ease,
          border-color 0.16s ease,
          color 0.16s ease,
          box-shadow 0.16s ease,
          transform 0.08s ease !important;
      }

      @media (hover: hover) and (pointer: fine) {
        .profile-feed-actions .small-btn:hover,
        .profile-feed-actions .small-btn:focus-visible {
          border-color: rgba(255, 189, 74, 0.46) !important;
          background:
            linear-gradient(180deg, rgba(255, 189, 74, 0.18), rgba(255, 255, 255, 0.055)),
            rgba(24, 34, 28, 0.94) !important;
          color: #fff8ea !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.075),
            0 12px 26px rgba(255, 171, 48, 0.10),
            0 12px 28px rgba(0, 0, 0, 0.22) !important;
          outline: none !important;
        }
      }

      @media (hover: none), (pointer: coarse) {
        .profile-feed-actions .profile-feed-like-btn:hover,
        .profile-feed-actions .profile-feed-like-btn:focus,
        .profile-feed-actions .profile-feed-like-btn:focus-visible,
        .profile-feed-actions .profile-feed-like-btn:active {
          border-color: rgba(244, 178, 74, 0.22) !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.045)),
            rgba(18, 28, 23, 0.86) !important;
          color: rgba(255,248,234,0.94) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.055),
            0 10px 22px rgba(0, 0, 0, 0.18) !important;
          outline: none !important;
          filter: none !important;
        }
      }

      .profile-feed-actions .small-btn:active {
        transform: scale(0.985) !important;
      }

      .profile-feed-open-btn {
        border-color: rgba(255, 189, 74, 0.42) !important;
        background:
          linear-gradient(180deg, rgba(255, 189, 74, 0.22), rgba(255, 255, 255, 0.06)),
          rgba(24, 34, 28, 0.94) !important;
        color: #fff8ea !important;
      }

      .profile-feed-like-btn,
      .profile-feed-comment-btn,
      .profile-feed-profile-btn {
        border-color: rgba(244, 178, 74, 0.22) !important;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.045)),
          rgba(18, 28, 23, 0.86) !important;
        color: rgba(255,248,234,0.94) !important;
      }

      @keyframes klevbyLikeTapFlash {
        0% {
          border-color: rgba(255, 189, 74, 0.70);
          background:
            linear-gradient(180deg, rgba(255, 189, 74, 0.28), rgba(255, 255, 255, 0.075)),
            rgba(30, 42, 34, 0.96);
          color: #fff8ea;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            0 10px 24px rgba(255, 171, 48, 0.14),
            0 10px 22px rgba(0, 0, 0, 0.20);
          transform: scale(0.985);
        }

        58% {
          border-color: rgba(255, 189, 74, 0.52);
          background:
            linear-gradient(180deg, rgba(255, 189, 74, 0.18), rgba(255, 255, 255, 0.06)),
            rgba(24, 34, 28, 0.94);
          color: #fff8ea;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 18px rgba(255, 171, 48, 0.10),
            0 10px 20px rgba(0, 0, 0, 0.18);
          transform: scale(0.992);
        }

        100% {
          border-color: rgba(244, 178, 74, 0.22);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.045)),
            rgba(18, 28, 23, 0.86);
          color: rgba(255,248,234,0.94);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.055),
            0 10px 22px rgba(0, 0, 0, 0.18);
          transform: translateZ(0);
        }
      }

      .profile-feed-actions .profile-feed-like-btn.klevby-like-tap-flash,
      .profile-feed-actions .profile-feed-like-btn.klevby-like-tap-flash:hover,
      .profile-feed-actions .profile-feed-like-btn.klevby-like-tap-flash:focus,
      .profile-feed-actions .profile-feed-like-btn.klevby-like-tap-flash:focus-visible,
      .profile-feed-actions .profile-feed-like-btn.klevby-like-tap-flash:active {
        animation: klevbyLikeTapFlash 145ms ease-out 1 both !important;
        outline: none !important;
        filter: none !important;
      }

      .home-empty-card {
        grid-column: 1 / -1;
        width: 100%;
        padding: 22px;
        border-radius: 26px;
        border: 1px solid rgba(244,178,74,0.14);
        background:
          radial-gradient(circle at 0% 0%, rgba(244,178,74,0.14), transparent 38%),
          rgba(13, 20, 17, 0.86);
        box-shadow: 0 12px 32px rgba(0,0,0,0.34);
      }

      .home-empty-icon {
        width: 54px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        border-radius: 20px;
        background: rgba(244,178,74,0.14);
        font-size: 26px;
      }

      .home-empty-card h3 {
        margin: 0 0 8px;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.15;
        font-weight: 900;
      }

      .home-empty-card p {
        margin: 0 0 16px;
        color: rgba(255,248,234,0.66);
        font-size: 14px;
        line-height: 1.5;
        font-weight: 600;
      }

      @media (min-width: 761px) {
        .profile-feed-card {
          contain: layout paint;
          will-change: auto;
        }

        .profile-feed-image {
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      }

      @media (max-width: 760px) {
        .profile-feed-card {
          width: 100%;
          max-width: calc(100vw - 24px) !important;
          min-width: 0 !important;
          margin-left: auto !important;
          margin-right: auto !important;
          border-radius: 26px !important;
        }

        .profile-feed-image {
          min-height: 280px !important;
          height: 34dvh !important;
          max-height: 340px !important;
          border-radius: 26px 26px 0 0 !important;
        }

        .profile-feed-body {
          padding: 13px 14px 15px !important;
          min-width: 0 !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .profile-feed-avatar-img,
        .profile-feed-avatar-fallback {
          width: 38px;
          height: 38px;
        }

        .profile-feed-author {
          margin-bottom: 10px;
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .profile-feed-author-name {
          font-size: 14px;
        }

        .profile-feed-author-action {
          font-size: 12px;
        }

        .profile-feed-title {
          font-size: 20px !important;
          line-height: 1.12 !important;
          margin-bottom: 11px !important;
          min-width: 0 !important;
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .profile-feed-tags {
          gap: 7px !important;
          margin-bottom: 11px !important;
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .profile-feed-tags .tag {
          min-height: 31px;
          padding: 7px 10px;
          font-size: 12px;
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .profile-feed-actions {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .profile-feed-actions .small-btn {
          height: 46px !important;
          min-height: 46px !important;
          max-height: 46px !important;
          padding: 0 8px !important;
          border-radius: 16px !important;
          font-size: 13px !important;
          min-width: 0 !important;
        }
      }

      @media (max-width: 380px) {
        .profile-feed-image {
          min-height: 250px !important;
          height: 31dvh !important;
          max-height: 310px !important;
        }

        .profile-feed-title {
          font-size: 18px !important;
        }

        .profile-feed-actions {
          gap: 7px !important;
        }

        .profile-feed-actions .small-btn {
          height: 44px !important;
          min-height: 44px !important;
          max-height: 44px !important;
          padding: 0 6px !important;
          border-radius: 15px !important;
          font-size: 12px !important;
        }
      }
    `;

    mountNode.appendChild(style);

    if (typeof options.runMobileFeedWidthLockBurst === "function") {
      options.runMobileFeedWidthLockBurst("styles_inserted");
    }

    return true;
  }

  window.KlevbyFeedRenderStyles = {
    ensureFeedStyles,
    FEED_STYLES_VERSION
  };
})();
