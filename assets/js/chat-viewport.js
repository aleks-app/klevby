(function () {
  if (window.KlevbyChatViewport) {
    return;
  }

  let isReady = false;

  function getModal() {
    return document.getElementById("klevby-chat-modal");
  }

  function getMessagesContainer() {
    return document.getElementById("chat-messages");
  }

  function updateViewportVars() {
    const vv = window.visualViewport;

    let height = vv ? vv.height : window.innerHeight;
    let width = vv ? vv.width : window.innerWidth;
    let offsetTop = vv ? vv.offsetTop : 0;
    let offsetLeft = vv ? vv.offsetLeft : 0;

    const lastGoodHeight = Number(document.documentElement.dataset.klevbyGoodHeight || "0");
    const lastGoodWidth = Number(document.documentElement.dataset.klevbyGoodWidth || "0");

    if (!Number.isFinite(height) || height < 420) {
      height = lastGoodHeight || window.innerHeight || screen.height || 720;
    }

    if (!Number.isFinite(width) || width < 280) {
      width = lastGoodWidth || window.innerWidth || screen.width || 390;
    }

    if (!Number.isFinite(height) || height < 420) {
      height = 720;
    }

    if (!Number.isFinite(width) || width < 280) {
      width = 390;
    }

    if (!Number.isFinite(offsetTop) || offsetTop < 0) {
      offsetTop = 0;
    }

    if (!Number.isFinite(offsetLeft) || offsetLeft < 0) {
      offsetLeft = 0;
    }

    document.documentElement.dataset.klevbyGoodHeight = String(height);
    document.documentElement.dataset.klevbyGoodWidth = String(width);

    document.documentElement.style.setProperty("--klevby-vvh", `${height}px`);
    document.documentElement.style.setProperty("--klevby-vvw", `${width}px`);
    document.documentElement.style.setProperty("--klevby-vtop", `${offsetTop}px`);
    document.documentElement.style.setProperty("--klevby-vleft", `${offsetLeft}px`);
  }

  function scrollChatToBottom() {
    const messages = getMessagesContainer();

    if (!messages) return;

    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function updateAndScrollIfChatOpen() {
    updateViewportVars();

    const modal = getModal();

    if (modal && modal.classList.contains("open")) {
      scrollChatToBottom();
    }
  }

  function lockChatPage() {
    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");
  }

  function unlockChatPage() {
    document.documentElement.classList.remove("klevby-chat-lock");
    document.body.classList.remove("klevby-chat-lock");
  }

  function init() {
    if (isReady) return;

    isReady = true;

    updateViewportVars();

    window.addEventListener(
      "resize",
      updateAndScrollIfChatOpen,
      { passive: true }
    );

    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(updateViewportVars, 250);
      },
      { passive: true }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        updateAndScrollIfChatOpen,
        { passive: true }
      );

      window.visualViewport.addEventListener(
        "scroll",
        updateViewportVars,
        { passive: true }
      );
    }
  }

  window.KlevbyChatViewport = {
    init,
    updateViewportVars,
    scrollChatToBottom,
    lockChatPage,
    unlockChatPage
  };
})();
