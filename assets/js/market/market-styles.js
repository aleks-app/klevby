(function () {
  window.KlevbyMarket = window.KlevbyMarket || {};

  function injectMarketStyles() {
    if (document.getElementById("klevbyMarketStyles")) return;

    const style = document.createElement("style");
    style.id = "klevbyMarketStyles";

    style.textContent = `
      .market-layout {
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: stretch;
      }

      .market-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        justify-content: flex-start;
        margin: 0 0 2px;
      }

      .market-toolbar-left {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .market-toolbar-btn {
        min-height: 42px;
        padding: 11px 16px;
        border-radius: 999px;
        font-size: 14px;
        line-height: 1.1;
        white-space: nowrap;
      }

      .market-form-box {
        max-width: 760px;
        width: 100%;
        background: rgba(255,255,255,0.045);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 22px;
        padding: 20px;
      }

      .market-form-box h2 {
        margin: 0 0 14px;
        font-size: 22px;
        color: #ffffff;
        font-weight: 800;
      }

      .market-note {
        margin-top: 12px;
        color: rgba(244,251,247,0.58);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 500;
      }
      .market-upload-row {
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .market-file-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 120px;
        flex: 1;
      }
      .market-file-status {
        color: #d6fff2;
        font-size: 12px;
        font-weight: 700;
      }
      .market-file-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        cursor: pointer;
        white-space: nowrap;
      }
      .market-file-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .market-file-name {
        color: rgba(244,251,247,0.72);
        font-size: 12px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .market-file-clear-btn {
        min-height: 34px;
        padding: 7px 10px;
      }
      .market-photo-preview {
        margin-top: 6px;
        width: 96px;
        height: 96px;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
      }
      .market-photo-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      #marketSaveBtn.is-saving,
      #marketSaveBtn:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }

      .market-list-panel {
        width: 100%;
      }

      .market-view-switch,
      .market-owner-tabs {
        gap: 6px;
        margin: 0 0 8px;
        padding: 4px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.11);
        background: rgba(7,15,12,0.72);
      }

      .market-view-switch,
      .market-owner-tabs {
        display: grid;
        width: 100%;
        box-sizing: border-box;
      }

      .market-view-switch {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .market-owner-tabs {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .market-view-btn,
      .market-owner-tab-btn {
        width: 100%;
        min-width: 0;
        min-height: 36px;
        padding: 8px 10px;
        border-radius: 10px;
        border-color: transparent;
        background: transparent;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .market-view-mine-short {
        display: none;
      }

      .market-view-btn.is-active,
      .market-owner-tab-btn.is-active {
        background: rgba(87,230,178,0.18);
        border-color: rgba(87,230,178,0.34);
        color: #d6fff2;
      }

      .market-search-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 9px;
        min-height: 54px;
        margin: 0 6px 8px;
        padding: 0 10px 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(244, 122, 43, 0.24);
        background: linear-gradient(180deg, rgba(29, 31, 33, 0.95), rgba(21, 23, 25, 0.97));
        box-shadow: 0 6px 14px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.03);
      }

      .market-search-icon {
        width: 18px;
        height: 18px;
        color: rgba(244, 241, 238, 0.55);
        opacity: 1;
      }

      .market-search-icon::before {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        background: currentColor;
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='6.5' fill='none' stroke='black' stroke-width='2.2'/%3E%3Cpath d='M16 16L21 21' stroke='black' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='6.5' fill='none' stroke='black' stroke-width='2.2'/%3E%3Cpath d='M16 16L21 21' stroke='black' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
      }

      .market-search-input {
        width: 100%;
        min-width: 0;
        border: none;
        background: transparent;
        box-shadow: none;
        outline: none;
        padding: 0;
        border-radius: 0;
        appearance: none;
        -webkit-appearance: none;
        color: #f4f1ee;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
      }

      .market-search-input::placeholder {
        color: rgba(145, 139, 136, 0.95);
      }

      #marketSearchInput.market-search-input,
      #marketSearchInput.market-search-input:focus,
      #marketSearchInput.market-search-input:focus-visible,
      #marketSearchInput.market-search-input:active {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        outline: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        -webkit-appearance: none !important;
        appearance: none !important;
      }

      #marketSearchInput.market-search-input::-webkit-search-decoration,
      #marketSearchInput.market-search-input::-webkit-search-cancel-button,
      #marketSearchInput.market-search-input::-webkit-search-results-button,
      #marketSearchInput.market-search-input::-webkit-search-results-decoration {
        -webkit-appearance: none;
      }


      .market-search-filters-btn {
        min-width: 26px;
        height: 26px;
        border: none;
        border-radius: 999px;
        background: rgba(244, 122, 43, 0.08);
        color: #ffd08a;
        font-size: 21px;
        line-height: 1;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }

      .market-search-filters-btn:active {
        transform: scale(0.98);
      }

      .market-filters {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr 0.8fr;
        gap: 10px;
        margin-bottom: 12px;
      }

      .market-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      .market-card {
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 10px 28px rgba(0,0,0,0.22);
        transition: 0.22s ease;
        cursor: pointer;
      }

      .market-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 34px rgba(0,0,0,0.30);
        border-color: rgba(244,178,74,0.22);
      }

      .market-card:active {
        transform: translateY(-1px) scale(0.992);
      }

      .market-card:focus-visible {
        outline: 2px solid rgba(255,183,69,0.92);
        outline-offset: 4px;
      }

      .market-img {
        position: relative;
        height: 150px;
        overflow: hidden;
      }

      .market-photo-frame {
        position: relative;
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, rgba(76,88,82,0.36), rgba(52,64,59,0.42));
      }

      .market-photo-skeleton {
        position: absolute;
        inset: 0;
        z-index: 1;
        background:
          linear-gradient(110deg, rgba(255,255,255,0.08) 24%, rgba(255,255,255,0.26) 42%, rgba(255,255,255,0.08) 62%),
          linear-gradient(180deg, rgba(116,128,121,0.38), rgba(80,92,86,0.44));
        background-size: 220% 100%, 100% 100%;
        animation: marketPhotoPulse 1.4s ease-in-out infinite;
        transition: opacity 0.24s ease;
        pointer-events: none;
      }

      .market-photo {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.5;
        transition: opacity 0.2s ease;
      }

      .market-photo.is-loaded {
        opacity: 1;
      }

      .market-photo-frame.is-loaded .market-photo-skeleton {
        opacity: 0;
      }

      .market-photo-frame.is-error .market-photo-skeleton {
        animation: none;
        opacity: 1;
        background:
          linear-gradient(180deg, rgba(36,44,40,0.95), rgba(18,26,23,0.96)),
          radial-gradient(circle at 50% 40%, rgba(255,180,82,0.22), rgba(0,0,0,0) 48%);
      }

      .market-card-photo-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42));
      }

      .market-details-img {
        min-height: 330px;
        border-radius: 28px 28px 0 0;
        overflow: hidden;
      }

      .market-details-photo-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.38));
      }

      @keyframes marketPhotoPulse {
        0% { background-position: 100% 0, 0 0; }
        100% { background-position: -100% 0, 0 0; }
      }

      .market-open-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 7px 10px;
        border-radius: 999px;
        background: rgba(5,10,8,0.72);
        color: rgba(255,255,255,0.92);
        border: 1px solid rgba(255,255,255,0.16);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(0,0,0,0.26);
      }

      .market-body {
        padding: 15px;
      }

      .market-title {
        margin: 0 0 7px;
        color: #ffffff;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.25;
      }

      .market-price {
        margin-bottom: 8px;
        color: #57e6b2;
        font-size: 20px;
        font-weight: 800;
      }

      .market-city {
        color: rgba(244,251,247,0.72);
        font-size: 13px;
        font-weight: 700;
      }


      .market-text {
        color: rgba(244,251,247,0.66);
        font-size: 13px;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .market-card-more {
        margin-top: 10px;
        color: rgba(255,190,82,0.92);
        font-size: 12px;
        line-height: 1.25;
        font-weight: 900;
      }

      .market-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 12px 0;
      }

      .market-tag {
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        color: rgba(244,251,247,0.72);
        font-size: 11px;
        font-weight: 700;
      }

      .market-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        align-items: center;
        margin-top: 12px;
      }

      .market-actions .small-btn {
        padding: 9px 12px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.1;
      }

      .market-contact-missing {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.055);
        color: rgba(244,251,247,0.55);
        font-size: 12px;
        font-weight: 800;
      }

      .market-details-open {
        overflow: hidden;
      }

      .market-details-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 22px;
      }

      .market-details-backdrop {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        padding: 0;
        background: rgba(0,0,0,0.68);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        cursor: pointer;
      }

      .market-details-panel {
        position: relative;
        z-index: 1;
        width: min(920px, 100%);
        max-height: min(86vh, 840px);
        overflow: auto;
        border-radius: 28px;
        background:
          radial-gradient(circle at 14% 0%, rgba(244,178,74,0.16), transparent 34%),
          linear-gradient(180deg, rgba(26,35,30,0.98), rgba(8,14,12,0.98));
        border: 1px solid rgba(255,255,255,0.11);
        box-shadow: 0 28px 80px rgba(0,0,0,0.48);
      }

      .market-details-close {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 3;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 999px;
        background: rgba(0,0,0,0.42);
        color: #ffffff;
        font-size: 24px;
        line-height: 1;
        font-weight: 800;
        cursor: pointer;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .market-details-body {
        padding: 24px;
      }

      .market-details-kicker {
        margin: 0 0 8px;
        color: rgba(255,190,82,0.94);
        font-size: 13px;
        line-height: 1.25;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .market-details-title {
        margin: 0 0 10px;
        color: #ffffff;
        font-size: clamp(28px, 5vw, 44px);
        line-height: 1.02;
        letter-spacing: -0.9px;
        font-weight: 900;
      }

      .market-details-price {
        margin: 0 0 16px;
        color: #57e6b2;
        font-size: 32px;
        line-height: 1.05;
        font-weight: 900;
      }

      .market-details-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 18px;
      }

      .market-details-description {
        margin: 0;
        color: rgba(244,251,247,0.78);
        font-size: 16px;
        line-height: 1.62;
        white-space: pre-wrap;
      }

      .market-details-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }

      .market-details-actions .small-btn {
        min-height: 44px;
        padding: 12px 16px;
        border-radius: 16px;
      }

      .market-owner-actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .market-owner-actions-top,
      .market-owner-actions-more {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .market-owner-actions .small-btn {
        width: 100%;
        min-width: 0;
        justify-content: center;
      }

      .market-owner-more-toggle {
        width: 100%;
      }

      .market-owner-actions-more.hidden {
        display: none;
      }


      .market-status-line {
        margin: 2px 0 10px;
        padding: 0;
        min-height: auto;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: rgba(244,251,247,0.62);
        font-size: 12px;
        font-weight: 700;
      }

      .market-empty-state {
        width: 100%;
        grid-column: 1 / -1;
        box-sizing: border-box;
        padding: 20px 14px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.08);
        background: linear-gradient(180deg, rgba(12,22,18,0.8), rgba(8,14,12,0.84));
        text-align: center;
        color: rgba(244,251,247,0.78);
      }

      .market-empty-state strong {
        display: block;
        margin-bottom: 6px;
        color: #f4fbf7;
        font-size: 16px;
      }

      .market-empty-state span {
        color: rgba(244,251,247,0.62);
        font-size: 13px;
      }
      .market-new-items-notice {
        margin: 8px 0 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: auto;
        max-width: 100%;
        min-height: 36px;
        border: 1px solid rgba(87,230,178,0.38);
        border-radius: 999px;
        padding: 8px 14px;
        background: rgba(87,230,178,0.14);
        color: #bdf7e4;
        font-size: 13px;
        font-weight: 700;
      }

      @media (max-width: 900px) {
        .market-view-btn,
        .market-owner-tab-btn {
          font-size: 12px;
          padding: 8px 8px;
        }
        .market-layout {
          gap: 12px;
        }

        .market-toolbar {
          align-items: stretch;
        }

        .market-toolbar-left {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .market-toolbar-btn {
          width: 100%;
          min-height: 46px;
          padding: 12px 12px;
          font-size: 13px;
        }

        .market-new-items-notice {
          width: 100%;
          justify-content: flex-start;
          font-size: 12px;
          min-height: 38px;
          padding: 9px 12px;
        }

        .market-form-box {
          max-width: none;
          padding: 16px;
          border-radius: 22px;
        }

        .market-form-box h2 {
          font-size: 21px;
        }

        .market-filters {
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .market-view-switch,
        .market-owner-tabs {
          margin-bottom: 8px;
        }

        .market-grid {
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .market-img {
          height: 120px;
        }

        .market-body {
          padding: 12px;
        }

        .market-title {
          font-size: 13px;
        }

        .market-price {
          font-size: 16px;
        }

        .market-text {
          font-size: 12px;
          -webkit-line-clamp: 2;
        }

        .market-card-more {
          font-size: 11px;
        }

        .market-actions .small-btn {
          padding: 8px 10px;
          font-size: 12px;
        }

        .market-details-overlay {
          align-items: stretch;
          justify-content: stretch;
          padding: 0;
        }

        .market-details-panel {
          width: 100%;
          height: 100dvh;
          max-height: 100dvh;
          border-radius: 0;
          border-left: 0;
          border-right: 0;
          overflow: auto;
        }

        .market-details-close {
          top: calc(12px + env(safe-area-inset-top));
          right: 14px;
          width: 46px;
          height: 46px;
          font-size: 26px;
        }

        .market-details-img {
          min-height: 42dvh;
          border-radius: 0;
        }

        .market-details-body {
          padding: 22px 18px calc(34px + env(safe-area-inset-bottom));
        }

        .market-details-title {
          font-size: 30px;
        }

        .market-details-price {
          font-size: 28px;
        }

        .market-details-description {
          font-size: 15px;
        }
      }

      @media (max-width: 520px) {
        .market-view-mine-long {
          display: none;
        }

        .market-view-mine-short {
          display: inline;
        }
      }

      @media (max-width: 430px) {
        .market-toolbar-left {
          grid-template-columns: 1fr;
        }

        .market-view-btn,
        .market-owner-tab-btn {
          font-size: 11px;
          padding: 8px 6px;
        }
        .market-grid {
          grid-template-columns: 1fr;
        }

        .market-img {
          height: 178px;
        }

        .market-title {
          font-size: 18px;
        }

        .market-price {
          font-size: 22px;
        }

        .market-text {
          font-size: 14px;
          -webkit-line-clamp: 3;
        }

        .market-open-badge {
          min-height: 32px;
          padding: 8px 11px;
          font-size: 11px;
        }

        .market-actions {
          gap: 8px;
        }

        .market-actions .small-btn {
          min-height: 38px;
          padding: 9px 12px;
          font-size: 13px;
        }
      }

      @media (max-width: 430px) {
        .market-search-row {
          min-height: 52px;
          width: calc(100% - 14px);
          margin: 0 auto 7px;
          padding: 0 9px 0 11px;
          gap: 8px;
        }

        .market-search-icon {
          width: 17px;
          height: 17px;
        }

        .market-search-input {
          font-size: 13px;
        }

        .market-search-filters-btn {
          min-width: 24px;
          height: 24px;
          font-size: 19px;
        }
      }

    `;

    document.head.appendChild(style);
  }

  window.KlevbyMarket.injectMarketStyles = injectMarketStyles;

  console.log("Klevby market styles loaded");
})();
