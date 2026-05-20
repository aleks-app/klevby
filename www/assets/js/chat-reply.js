(function () {
  if (window.KlevbyChatReply) {
    return;
  }

  let ctx = null;
  let replyTarget = null;

  function init(options = {}) {
    ctx = options || {};
  }

  function getCtx() {
    if (!ctx) {
      throw new Error("KlevbyChatReply не инициализирован. Проверь подключение chat-reply.js перед chat.js");
    }

    return ctx;
  }

  function getElements() {
    return getCtx().elements || {};
  }

  function hideMessageMenu() {
    const currentCtx = getCtx();

    if (typeof currentCtx.hideMessageMenu === "function") {
      currentCtx.hideMessageMenu();
    }
  }

  function clearReply() {
    replyTarget = null;

    const { replyPreview, replyAuthor, replyText } = getElements();

    if (replyPreview) {
      replyPreview.classList.add("hidden");
    }

    if (replyAuthor) {
      replyAuthor.textContent = "";
    }

    if (replyText) {
      replyText.textContent = "";
    }
  }

  function setReplyTarget(messageData) {
    if (!messageData) return;

    const { replyPreview, replyAuthor, replyText, input } = getElements();

    replyTarget = {
      author: messageData.isMine ? "Вы" : messageData.author,
      text: messageData.content || ""
    };

    if (replyAuthor) {
      replyAuthor.textContent = "Ответ: " + replyTarget.author;
    }

    if (replyText) {
      replyText.textContent = replyTarget.text;
    }

    if (replyPreview) {
      replyPreview.classList.remove("hidden");
    }

    hideMessageMenu();

    requestAnimationFrame(() => {
      if (input && typeof input.focus === "function") {
        input.focus();
      }
    });
  }

  function buildMessageContent(value) {
    if (!replyTarget) return value;

    const quoted = String(replyTarget.text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    return `↩ Ответ ${replyTarget.author}: ${quoted}\n${value}`;
  }

  function getReplyTarget() {
    return replyTarget;
  }

  window.KlevbyChatReply = {
    init,
    clearReply,
    setReplyTarget,
    buildMessageContent,
    getReplyTarget
  };
})();
