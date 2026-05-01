function injectExtraChatStyles() {
  const oldStyle = document.getElementById("klevby-chat-extra-styles");
  if (oldStyle) oldStyle.remove();

  const style = document.createElement("style");
  style.id = "klevby-chat-extra-styles";

  style.textContent = `
    .hidden {
      display: none !important;
    }

    #chat-desktop-btn,
    .klevby-chat-launcher {
      position: fixed !important;
      right: 24px !important;
      bottom: 24px !important;
      width: 56px !important;
      height: 56px !important;
      border-radius: 50% !important;
      border: 1px solid rgba(58, 180, 130, 0.28) !important;
      background: #101918 !important;
      color: #ffffff !important;
      font-size: 25px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      z-index: 999998 !important;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42) !important;
    }

    #klevby-chat-modal {
      position: fixed !important;
      inset: 0 !important;
      z-index: 999999 !important;
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0, 0, 0, 0.62) !important;
      padding: 0 !important;
    }

    #klevby-chat-modal.open {
      display: flex !important;
    }

    #klevby-chat-modal.hidden {
      display: none !important;
    }

    #chat-window,
    .klevby-chat-window {
      width: min(96vw, 460px) !important;
      height: min(86vh, 700px) !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border-radius: 18px !important;
      background: #07100f !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.58) !important;
      color: #f4f7f5 !important;
    }

    #chat-header,
    .klevby-chat-header {
      height: 58px !important;
      min-height: 58px !important;
      padding: 8px 10px !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      background: #0b1514 !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
      flex: 0 0 auto !important;
    }

    .klevby-chat-head-main {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
    }

    .klevby-chat-avatar {
      width: 36px !important;
      height: 36px !important;
      flex: 0 0 36px !important;
      border-radius: 50% !important;
      background: #1b2b28 !important;
      color: #b8f5d6 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 15px !important;
      font-weight: 800 !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    .klevby-chat-title-wrap {
      min-width: 0 !important;
    }

    .klevby-chat-title {
      font-size: 15px !important;
      line-height: 1.15 !important;
      font-weight: 800 !important;
      color: #ffffff !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .klevby-chat-subtitle {
      margin-top: 2px !important;
      font-size: 11px !important;
      line-height: 1.15 !important;
      font-weight: 500 !important;
      color: rgba(244, 247, 245, 0.48) !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #back-chat,
    #close-chat,
    .klevby-chat-back,
    .klevby-chat-close {
      width: 34px !important;
      height: 34px !important;
      flex: 0 0 34px !important;
      border-radius: 50% !important;
      border: 0 !important;
      background: transparent !important;
      color: rgba(255, 255, 255, 0.72) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 24px !important;
      line-height: 1 !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    #back-chat:hover,
    #close-chat:hover {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #ffffff !important;
    }

    #call-chat,
    .klevby-chat-call {
      width: 34px !important;
      height: 34px !important;
      flex: 0 0 34px !important;
      border-radius: 50% !important;
      border: 0 !important;
      background: rgba(58, 180, 130, 0.10) !important;
      color: #49d69b !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .klevby-call-status-bar {
      min-height: 32px !important;
      max-height: 38px !important;
      padding: 5px 9px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      background: #101d1b !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
      color: rgba(244, 247, 245, 0.76) !important;
      flex: 0 0 auto !important;
    }

    .klevby-call-status-info {
      min-width: 0 !important;
      flex: 1 1 auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    .klevby-call-status-title {
      color: #d7ffe8 !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    .klevby-call-status-text {
      margin: 0 !important;
      color: rgba(244, 247, 245, 0.48) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .klevby-call-end,
    .klevby-call-reject {
      height: 24px !important;
      min-height: 24px !important;
      padding: 0 9px !important;
      border-radius: 999px !important;
      border: 0 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      background: rgba(232, 81, 81, 0.16) !important;
      color: #ff8c8c !important;
    }

    .klevby-incoming-call {
      min-height: 38px !important;
      padding: 6px 9px !important;
      display: grid !important;
      grid-template-columns: 26px 1fr auto !important;
      align-items: center !important;
      gap: 8px !important;
      background: #101d1b !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
      flex: 0 0 auto !important;
    }

    .klevby-incoming-icon {
      width: 26px !important;
      height: 26px !important;
      border-radius: 50% !important;
      background: rgba(58, 180, 130, 0.18) !important;
      color: #58e6a5 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 13px !important;
      font-weight: 800 !important;
    }

    .klevby-incoming-info {
      min-width: 0 !important;
    }

    .klevby-incoming-title {
      color: rgba(244, 247, 245, 0.84) !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1.1 !important;
    }

    .klevby-incoming-text {
      margin-top: 2px !important;
      color: rgba(244, 247, 245, 0.48) !important;
      font-size: 11px !important;
      line-height: 1.1 !important;
      overflow: hidden !important;
      white-space: nowrap !important;
      text-overflow: ellipsis !important;
    }

    .klevby-incoming-actions {
      grid-column: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    .klevby-call-accept {
      height: 24px !important;
      min-height: 24px !important;
      padding: 0 9px !important;
      border-radius: 999px !important;
      border: 0 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      background: rgba(58, 180, 130, 0.18) !important;
      color: #58e6a5 !important;
    }

    .klevby-chat-pinned {
      height: 30px !important;
      min-height: 30px !important;
      padding: 0 12px !important;
      display: flex !important;
      align-items: center !important;
      gap: 7px !important;
      background: #0a1211 !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
      color: rgba(244, 247, 245, 0.42) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      text-align: left !important;
      flex: 0 0 auto !important;
    }

    .klevby-pinned-icon {
      width: auto !important;
      height: auto !important;
      flex: 0 0 auto !important;
      background: transparent !important;
      font-size: 12px !important;
    }

    .klevby-pinned-copy {
      min-width: 0 !important;
      display: block !important;
    }

    .klevby-pinned-title {
      display: inline !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 1 !important;
      color: rgba(244, 247, 245, 0.48) !important;
    }

    .klevby-pinned-text {
      display: none !important;
    }

    .klevby-chat-tabs {
      height: 44px !important;
      min-height: 44px !important;
      padding: 6px 10px !important;
      display: flex !important;
      gap: 6px !important;
      background: #07100f !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
      flex: 0 0 auto !important;
    }

    .klevby-chat-tab {
      flex: 1 1 0 !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: transparent !important;
      color: rgba(244, 247, 245, 0.48) !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      min-height: 32px !important;
    }

    .klevby-chat-tab.active {
      background: #162320 !important;
      color: #dfffee !important;
    }

    .klevby-unread-badge {
      min-width: 17px !important;
      height: 17px !important;
      padding: 0 5px !important;
      margin-left: 4px !important;
      border-radius: 999px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #d84d4d !important;
      color: #ffffff !important;
      font-size: 10px !important;
      line-height: 17px !important;
      font-weight: 800 !important;
    }

    .klevby-private-people {
      min-height: 42px !important;
      padding: 6px 10px !important;
      display: flex !important;
      gap: 6px !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      background: #07100f !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
      flex: 0 0 auto !important;
      -webkit-overflow-scrolling: touch !important;
    }

    .klevby-private-person {
      min-height: 30px !important;
      padding: 4px 9px !important;
      border-radius: 999px !important;
      border: 0 !important;
      background: #111b19 !important;
      color: rgba(244, 247, 245, 0.72) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      flex: 0 0 auto !important;
    }

    .klevby-private-person.active {
      background: rgba(58, 180, 130, 0.18) !important;
      color: #dfffee !important;
    }

    .klevby-private-avatar {
      width: 22px !important;
      height: 22px !important;
      border-radius: 50% !important;
      background: #1b2b28 !important;
      color: #b8f5d6 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 11px !important;
      font-weight: 800 !important;
    }

    .klevby-private-name {
      max-width: 115px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      font-size: 12px !important;
    }

    .klevby-private-status {
      width: 7px !important;
      height: 7px !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, 0.18) !important;
    }

    .klevby-private-status.online {
      background: #49d69b !important;
      box-shadow: none !important;
    }

    #chat-messages,
    .klevby-chat-messages {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      padding: 10px 10px 12px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      background: #030707 !important;
      color: #f4f7f5 !important;
      -webkit-overflow-scrolling: touch !important;
    }

    .klevby-date-divider {
      align-self: center !important;
      margin: 8px 0 6px !important;
      padding: 4px 9px !important;
      border-radius: 999px !important;
      background: rgba(255, 255, 255, 0.06) !important;
      color: rgba(244, 247, 245, 0.46) !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      border: 0 !important;
      line-height: 1 !important;
    }

    .chat-message-row {
      width: 100% !important;
      display: flex !important;
      align-items: flex-end !important;
      gap: 6px !important;
      margin-top: 8px !important;
      animation: chatMessageIn 0.18s ease both !important;
    }

    .chat-message-row.grouped-with-prev {
      margin-top: 2px !important;
    }

    .other-message-row {
      justify-content: flex-start !important;
    }

    .my-message-row {
      justify-content: flex-end !important;
    }

    .klevby-message-avatar {
      width: 28px !important;
      height: 28px !important;
      flex: 0 0 28px !important;
      border-radius: 50% !important;
      background: #17221f !important;
      color: #9de8c4 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    .my-message-row .klevby-message-avatar {
      display: none !important;
    }

    .chat-message-row.grouped-with-prev .klevby-message-avatar {
      visibility: hidden !important;
    }

    .chat-message-bubble {
      position: relative !important;
      max-width: 75% !important;
      min-width: 42px !important;
      padding: 7px 9px 5px !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
      box-shadow: none !important;
    }

    .other-message {
      background: #151c1b !important;
      color: #edf5f1 !important;
      border-radius: 15px 15px 15px 4px !important;
      border: 0 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .my-message {
      background: linear-gradient(135deg, #2d9d72, #227a5d) !important;
      color: #f3fff8 !important;
      border-radius: 15px 15px 4px 15px !important;
      border: 0 !important;
    }

    .chat-message-author {
      display: inline !important;
      margin: 0 6px 0 0 !important;
      color: #6ee0ad !important;
      font-size: 11px !important;
      line-height: 1.25 !important;
      font-weight: 700 !important;
      opacity: 1 !important;
    }

    .my-message .chat-message-author {
      display: none !important;
    }

    .chat-message-text {
      display: inline !important;
      font-size: 14px !important;
      line-height: 1.35 !important;
      font-weight: 400 !important;
      white-space: pre-wrap !important;
      color: inherit !important;
    }

    .klevby-message-footer {
      margin-top: 3px !important;
      display: flex !important;
      justify-content: flex-end !important;
      align-items: center !important;
      gap: 3px !important;
    }

    .chat-message-time {
      color: rgba(255, 255, 255, 0.46) !important;
      font-size: 10px !important;
      line-height: 1 !important;
      font-weight: 500 !important;
      margin: 0 !important;
      opacity: 1 !important;
    }

    .my-message .chat-message-time,
    .my-message .klevby-checks {
      color: rgba(255, 255, 255, 0.62) !important;
    }

    .klevby-checks {
      color: rgba(255, 255, 255, 0.62) !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }

    .klevby-message-reply {
      display: block !important;
      margin: 1px 0 5px !important;
      padding: 5px 7px !important;
      border-left: 2px solid rgba(110, 224, 173, 0.68) !important;
      border-radius: 8px !important;
      background: rgba(255, 255, 255, 0.06) !important;
      color: rgba(244, 247, 245, 0.72) !important;
      font-size: 11px !important;
      line-height: 1.25 !important;
      max-height: 44px !important;
      overflow: hidden !important;
    }

    .klevby-message-actions {
      display: none !important;
    }

    .chat-message-bubble:hover .klevby-message-actions {
      position: absolute !important;
      top: -24px !important;
      right: 6px !important;
      display: flex !important;
      gap: 4px !important;
    }

    .klevby-message-action {
      width: 23px !important;
      height: 23px !important;
      border-radius: 50% !important;
      border: 0 !important;
      background: rgba(20, 28, 27, 0.96) !important;
      color: rgba(255, 255, 255, 0.78) !important;
      font-size: 11px !important;
      cursor: pointer !important;
    }

    .klevby-message-menu {
      position: fixed !important;
      z-index: 1000001 !important;
      width: 170px !important;
      padding: 6px !important;
      border-radius: 16px !important;
      background: rgba(12, 24, 27, 0.96) !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      box-shadow: 0 18px 46px rgba(0,0,0,0.42) !important;
      backdrop-filter: blur(18px) !important;
      -webkit-backdrop-filter: blur(18px) !important;
    }

    .klevby-message-menu button {
      width: 100% !important;
      min-height: 38px !important;
      border: 0 !important;
      border-radius: 11px !important;
      background: transparent !important;
      color: #f4fbf7 !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      text-align: left !important;
      padding: 0 10px !important;
      cursor: pointer !important;
    }

    .chat-empty-state {
      margin: auto !important;
      max-width: 260px !important;
      text-align: center !important;
      color: rgba(244, 247, 245, 0.42) !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
    }

    .klevby-reply-preview {
      min-height: 42px !important;
      padding: 6px 10px !important;
      display: grid !important;
      grid-template-columns: 3px 1fr 28px !important;
      align-items: center !important;
      gap: 8px !important;
      background: #0b1514 !important;
      border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
      flex: 0 0 auto !important;
    }

    .klevby-reply-line {
      width: 3px !important;
      height: 28px !important;
      border-radius: 999px !important;
      background: #49d69b !important;
    }

    .klevby-reply-body {
      min-width: 0 !important;
    }

    .klevby-reply-author {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #74e0b1 !important;
      line-height: 1.2 !important;
    }

    .klevby-reply-text {
      margin-top: 1px !important;
      font-size: 11px !important;
      color: rgba(244, 247, 245, 0.48) !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      line-height: 1.2 !important;
    }

    .klevby-reply-cancel {
      width: 28px !important;
      height: 28px !important;
      border: 0 !important;
      border-radius: 50% !important;
      background: transparent !important;
      color: rgba(255, 255, 255, 0.56) !important;
      font-size: 20px !important;
      cursor: pointer !important;
    }

    #chat-input-area,
    .klevby-chat-inputbar {
      min-height: 54px !important;
      padding: 7px 9px !important;
      display: flex !important;
      align-items: center !important;
      gap: 7px !important;
      background: #0b1514 !important;
      border-top: 1px solid rgba(255, 255, 255, 0.055) !important;
      flex: 0 0 auto !important;
    }

    #attach-btn,
    .klevby-chat-attach {
      width: 34px !important;
      height: 34px !important;
      flex: 0 0 34px !important;
      border-radius: 50% !important;
      border: 0 !important;
      background: transparent !important;
      color: rgba(244, 247, 245, 0.54) !important;
      font-size: 25px !important;
      line-height: 1 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    #message-input,
    .klevby-chat-input {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      height: 38px !important;
      min-height: 38px !important;
      max-height: 38px !important;
      padding: 0 13px !important;
      border-radius: 999px !important;
      border: 0 !important;
      outline: none !important;
      background: #151c1b !important;
      color: #ffffff !important;
      font-size: 14px !important;
      line-height: 38px !important;
      margin: 0 !important;
      box-shadow: none !important;
    }

    #message-input::placeholder,
    .klevby-chat-input::placeholder {
      color: rgba(255, 255, 255, 0.36) !important;
    }

    #send-btn,
    .klevby-chat-send {
      width: 38px !important;
      height: 38px !important;
      flex: 0 0 38px !important;
      min-width: 38px !important;
      min-height: 38px !important;
      max-width: 38px !important;
      max-height: 38px !important;
      border-radius: 50% !important;
      border: 0 !important;
      background: #2d9d72 !important;
      color: #ffffff !important;
      font-size: 17px !important;
      font-weight: 800 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }

    @media (max-width: 768px) {
      html.klevby-chat-lock,
      body.klevby-chat-lock {
        overflow: hidden !important;
        overscroll-behavior: none !important;
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: var(--klevby-vvh, 100dvh) !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #chat-desktop-btn {
        display: none !important;
      }

      #klevby-chat-modal {
        position: fixed !important;
        top: var(--klevby-vtop, 0px) !important;
        left: 0 !important;
        right: 0 !important;
        bottom: auto !important;
        width: 100vw !important;
        height: var(--klevby-vvh, 100dvh) !important;
        background: #030707 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        border: 0 !important;
        border-radius: 0 !important;
        touch-action: none !important;
      }

      #klevby-chat-modal.open {
        display: block !important;
      }

      #chat-window,
      .klevby-chat-window {
        position: fixed !important;
        top: var(--klevby-vtop, 0px) !important;
        left: 0 !important;
        right: 0 !important;
        bottom: auto !important;
        width: 100vw !important;
        height: var(--klevby-vvh, 100dvh) !important;
        min-width: 100vw !important;
        min-height: 0 !important;
        max-width: none !important;
        max-height: none !important;
        border-radius: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        background: #030707 !important;
      }

      #chat-header,
      .klevby-chat-header {
        height: calc(56px + env(safe-area-inset-top)) !important;
        min-height: calc(56px + env(safe-area-inset-top)) !important;
        padding: calc(8px + env(safe-area-inset-top)) 10px 8px !important;
      }

      .klevby-chat-avatar {
        width: 34px !important;
        height: 34px !important;
        flex: 0 0 34px !important;
        font-size: 14px !important;
      }

      .klevby-chat-title {
        font-size: 15px !important;
      }

      .klevby-chat-subtitle {
        font-size: 11px !important;
      }

      .klevby-chat-pinned {
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 10px !important;
      }

      .klevby-chat-tabs {
        height: 42px !important;
        min-height: 42px !important;
        padding: 6px 8px !important;
      }

      .klevby-private-people {
        min-height: 40px !important;
        padding: 5px 8px !important;
      }

      #chat-messages,
      .klevby-chat-messages {
        padding: 9px 8px 10px !important;
      }

      .chat-message-bubble {
        max-width: 76% !important;
        padding: 7px 9px 5px !important;
      }

      .chat-message-text {
        font-size: 14px !important;
      }

      .klevby-message-avatar {
        width: 26px !important;
        height: 26px !important;
        flex: 0 0 26px !important;
        font-size: 10px !important;
      }

      .klevby-message-actions {
        display: none !important;
      }

      #chat-input-area,
      .klevby-chat-inputbar {
        min-height: calc(54px + env(safe-area-inset-bottom)) !important;
        padding: 7px 9px calc(7px + env(safe-area-inset-bottom)) !important;
      }

      .klevby-dialog-screen .klevby-chat-pinned,
      .klevby-dialog-screen .klevby-chat-tabs,
      .klevby-dialog-screen .klevby-private-people {
        display: none !important;
      }

      .klevby-dialog-screen #back-chat,
      .klevby-dialog-screen #call-chat {
        display: flex !important;
      }

      .klevby-dialog-screen .chat-message-bubble {
        max-width: 78% !important;
      }
    }

    @keyframes chatMessageIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  document.head.appendChild(style);
}
