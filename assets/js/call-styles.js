(function () {
  if (window.KlevbyCallStyles) {
    return;
  }

  function injectStyles() {
    const oldV6 = document.getElementById("klevby-call-styles-v6");
    if (oldV6) oldV6.remove();

    const oldV5 = document.getElementById("klevby-call-styles-v5");
    if (oldV5) oldV5.remove();

    const oldV4 = document.getElementById("klevby-call-styles-v4");
    if (oldV4) oldV4.remove();

    const oldV3 = document.getElementById("klevby-call-styles-v3");
    if (oldV3) oldV3.remove();

    const style = document.createElement("style");
    style.id = "klevby-call-styles-v6";

    style.textContent = `
      #klevby-chat-call {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #klevby-call-btn {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        flex: 0 0 auto !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.18) !important;
        color: #d9ffed !important;
        font-size: 22px !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28), 0 0 22px rgba(87, 230, 178, 0.16) !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
      }

      #klevby-call-btn:active {
        transform: scale(0.94) !important;
      }

      #klevby-call-btn.hidden {
        display: none !important;
      }

      .klevby-call-overlay,
      .klevby-incoming-call-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483640 !important;
        background:
          radial-gradient(circle at 50% 24%, rgba(87, 230, 178, 0.18), transparent 38%),
          linear-gradient(180deg, #0d2a23 0%, #041012 100%) !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
        touch-action: manipulation !important;
      }

      .klevby-call-card {
        width: min(420px, 100%) !important;
        min-height: 560px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
      }

      .klevby-call-avatar-wrap {
        position: relative !important;
        width: 150px !important;
        height: 150px !important;
        margin-bottom: 34px !important;
      }

      .klevby-call-pulse {
        position: absolute !important;
        inset: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.14) !important;
        animation: klevbyCallPulse 1.55s ease-out infinite !important;
      }

      .klevby-call-pulse:nth-child(2) {
        animation-delay: 0.45s !important;
      }

      .klevby-call-avatar {
        position: relative !important;
        z-index: 2 !important;
        width: 150px !important;
        height: 150px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #1f6f58, #174139) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 64px !important;
        font-weight: 900 !important;
        color: #d9ffed !important;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42) !important;
      }

      .klevby-call-name {
        max-width: 100% !important;
        font-size: 32px !important;
        line-height: 1.15 !important;
        font-weight: 900 !important;
        color: #ffffff !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .klevby-call-status {
        margin-top: 12px !important;
        font-size: 17px !important;
        font-weight: 800 !important;
        color: rgba(255, 255, 255, 0.64) !important;
      }

      .klevby-call-timer {
        margin-top: 14px !important;
        min-height: 24px !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        color: rgba(200, 255, 224, 0.9) !important;
      }

      .klevby-call-actions {
        margin-top: 76px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 38px !important;
      }

      .klevby-call-action-btn {
        width: 78px !important;
        height: 78px !important;
        border: 0 !important;
        border-radius: 50% !important;
        color: #ffffff !important;
        font-size: 31px !important;
        line-height: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
        touch-action: manipulation !important;
      }

      .klevby-call-action-btn:active {
        transform: scale(0.94) !important;
      }

      .klevby-call-accept {
        background: #28c990 !important;
        box-shadow: 0 18px 48px rgba(40, 201, 144, 0.32) !important;
      }

      .klevby-call-end,
      .klevby-call-decline {
        background: #e05252 !important;
        box-shadow: 0 18px 48px rgba(224, 82, 82, 0.34) !important;
      }

      .klevby-call-muted-note {
        margin-top: 28px !important;
        max-width: 340px !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
        font-weight: 700 !important;
        color: rgba(255, 255, 255, 0.42) !important;
      }

      .klevby-remote-audio {
        position: fixed !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0.01 !important;
        pointer-events: none !important;
      }

      #klevbyCallToast {
        position: fixed !important;
        left: 50% !important;
        bottom: max(26px, env(safe-area-inset-bottom)) !important;
        transform: translateX(-50%) !important;
        z-index: 2147483641 !important;
        padding: 11px 15px !important;
        border-radius: 999px !important;
        background: rgba(12, 22, 25, 0.96) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.88) !important;
        font-family: Montserrat, system-ui, sans-serif !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        box-shadow: 0 14px 38px rgba(0,0,0,0.35) !important;
      }

      @keyframes klevbyCallPulse {
        0% {
          transform: scale(0.86);
          opacity: 0.9;
        }

        100% {
          transform: scale(1.82);
          opacity: 0;
        }
      }

      @media (max-width: 768px) {
        .klevby-call-overlay,
        .klevby-incoming-call-overlay {
          padding-top: max(24px, env(safe-area-inset-top)) !important;
          padding-bottom: max(24px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-call-card {
          min-height: 100% !important;
        }

        .klevby-call-name {
          font-size: 30px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  window.KlevbyCallStyles = {
    injectStyles
  };
})();
