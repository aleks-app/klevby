(function () {
  if (window.KlevbyChatShell) {
    return;
  }

  const chatHTML = `
    <div id="chat-desktop-btn" class="klevby-chat-launcher" title="Открыть чат">💬</div>

    <div id="klevby-chat-modal" class="hidden">
      <div id="chat-window" class="klevby-chat-window">
        <div id="chat-header" class="klevby-chat-header">
          <button id="back-chat" class="klevby-chat-back hidden" type="button" aria-label="Назад">‹</button>

          <div class="klevby-chat-head-main">
            <div class="klevby-chat-avatar" id="chatAvatar">🎣</div>
            <div class="klevby-chat-title-wrap">
              <div class="klevby-chat-title" id="chatTitle">Чат рыбаков</div>
              <div class="klevby-chat-subtitle" id="chatSubtitle">Общий разговор Klevgo</div>
            </div>
          </div>

          <button id="klevby-push-btn" class="klevby-push-btn" type="button" aria-label="Включить уведомления" title="Включить уведомления">🔔</button>
          <button id="close-chat" class="klevby-chat-close" type="button" aria-label="Закрыть">×</button>
        </div>

        <div class="klevby-chat-tabs" role="tablist">
          <button id="publicChatTab" class="klevby-chat-tab active" type="button">Общий чат</button>
          <button id="privateChatTab" class="klevby-chat-tab" type="button">
            Личка <span id="privateUnreadBadge" class="klevby-unread-badge hidden">0</span>
          </button>
        </div>

        <div id="privateChatPeople" class="klevby-private-people hidden"></div>

        <div id="chat-messages" class="klevby-chat-messages"></div>

        <div id="messageContextMenu" class="klevby-message-menu hidden">
          <button id="contextReplyBtn" type="button">Ответить</button>
          <button id="contextCopyBtn" type="button">Скопировать</button>
          <button id="contextDeleteBtn" type="button">Удалить</button>
        </div>

        <div id="replyPreview" class="klevby-reply-preview hidden">
          <div class="klevby-reply-line"></div>
          <div class="klevby-reply-body">
            <div class="klevby-reply-author" id="replyAuthor"></div>
            <div class="klevby-reply-text" id="replyText"></div>
          </div>
          <button id="cancelReply" class="klevby-reply-cancel" type="button">×</button>
        </div>

        <div id="chat-input-area" class="klevby-chat-inputbar">
          <input
            type="text"
            id="message-input"
            class="klevby-chat-input"
            placeholder="Напиши сообщение..."
            autocomplete="off"
          />
          <button id="send-btn" class="klevby-chat-send" type="button">➤</button>
        </div>
      </div>
    </div>
  `;

  function getElement(id) {
    return document.getElementById(id);
  }

  function mount() {
    const oldModal = getElement("klevby-chat-modal");
    const oldLauncher = getElement("chat-desktop-btn");

    if (oldModal) oldModal.remove();
    if (oldLauncher) oldLauncher.remove();

    document.body.insertAdjacentHTML("beforeend", chatHTML);

    return {
      modal: getElement("klevby-chat-modal"),
      chatWindow: getElement("chat-window"),
      messagesContainer: getElement("chat-messages"),
      input: getElement("message-input"),
      sendBtn: getElement("send-btn"),

      publicTab: getElement("publicChatTab"),
      privateTab: getElement("privateChatTab"),
      privatePeople: getElement("privateChatPeople"),
      privateUnreadBadge: getElement("privateUnreadBadge"),

      chatTitle: getElement("chatTitle"),
      chatSubtitle: getElement("chatSubtitle"),
      chatAvatar: getElement("chatAvatar"),

      backBtn: getElement("back-chat"),
      pushBtn: getElement("klevby-push-btn"),
      replyPreview: getElement("replyPreview"),
      replyAuthor: getElement("replyAuthor"),
      replyText: getElement("replyText"),

      messageContextMenu: getElement("messageContextMenu"),
      contextReplyBtn: getElement("contextReplyBtn"),
      contextCopyBtn: getElement("contextCopyBtn"),
      contextDeleteBtn: getElement("contextDeleteBtn")
    };
  }

  window.KlevbyChatShell = {
    mount
  };
})();
