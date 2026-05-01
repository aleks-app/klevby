(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  const initInterval = setInterval(() => {
    if (window.supabase) {
      clearInterval(initInterval);
      const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      setupChat(chatDb);
    }
  }, 500);

  async function setupChat(chatDb) {
    let chatCurrentUser = null;

    try {
      const { data } = await chatDb.auth.getUser();
      chatCurrentUser = data?.user || null;
    } catch (error) {
      console.warn("Не удалось получить пользователя чата:", error);
    }

    injectChatStyles();

    const chatHTML = `
      <div id="klevby-chat-modal" class="klevby-chat-modal">
        <div class="klevby-chat-window">
          <div class="klevby-chat-header">
            <div>
              <div class="klevby-chat-title">Чат рыбаков 🎣</div>
              <div class="klevby-chat-subtitle">Общий разговор по рыбалке</div>
            </div>
            <button id="close-chat" class="klevby-chat-close" aria-label="Закрыть чат">&times;</button>
          </div>

          <div id="chat-messages" class="klevby-chat-messages"></div>

          <div class="klevby-chat-inputbar">
            <input
              type="text"
              id="message-input"
              class="klevby-chat-input"
              placeholder="Напиши сообщение..."
              autocomplete="off"
            />
            <button id="send-btn" class="klevby-chat-send" aria-label="Отправить сообщение">➤</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", chatHTML);

    const modal = document.getElementById("klevby-chat-modal");
    const messagesContainer = document.getElementById("chat-messages");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");

    document.addEventListener("click", (event) => {
      if (event.target.closest("#nav-chat")) {
        modal.classList.add("open");
        setTimeout(() => {
          input.focus();
          scrollChatToBottom();
        }, 120);
      }

      if (event.target.id === "close-chat" || event.target.id === "klevby-chat-modal") {
        modal.classList.remove("open");
      }
    });

    function scrollChatToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHtml(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getUserName() {
      if (chatCurrentUser?.email) {
        return chatCurrentUser.email.split("@")[0] || "Рыбак";
      }

      return localStorage.getItem("klevby_author_name") || "Рыбак";
    }

    function formatMessageTime(createdAt) {
      if (!createdAt) return "";

      try {
        return new Date(createdAt).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch {
        return "";
      }
    }

    function playBubbleSound() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(260, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(620, audioCtx.currentTime + 0.08);
        oscillator.frequency.exponentialRampToValueAtTime(380, audioCtx.currentTime + 0.16);

        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.22);

        setTimeout(() => {
          audioCtx.close().catch(() => {});
        }, 350);
      } catch (error) {
        console.warn("Звук не воспроизвелся:", error);
      }
    }

    function renderMessage(message) {
      const isMine =
        Boolean(chatCurrentUser?.id) &&
        Boolean(message.user_id) &&
        String(message.user_id) === String(chatCurrentUser.id);

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      const author = escapeHtml(isMine ? "Вы" : (message.user_name || "Рыбак"));
      const content = escapeHtml(message.content || "");
      const time = escapeHtml(formatMessageTime(message.created_at));

      bubble.innerHTML = `
        <div class="chat-message-author">${author}</div>
        <div class="chat-message-text">${content}</div>
        ${time ? `<div class="chat-message-time">${time}</div>` : ""}
      `;

      row.appendChild(bubble);
      messagesContainer.appendChild(row);
      scrollChatToBottom();
    }

    async function send() {
      const value = input.value.trim();

      if (!value) return;

      sendBtn.disabled = true;

      const messagePayload = {
        user_name: getUserName(),
        content: value,
        user_id: chatCurrentUser?.id || null
      };

      let result = await chatDb.from("messages").insert([messagePayload]);

      if (result.error && String(result.error.message || "").toLowerCase().includes("user_id")) {
        result = await chatDb.from("messages").insert([{
          user_name: messagePayload.user_name,
          content: messagePayload.content
        }]);
      }

      sendBtn.disabled = false;

      if (result.error) {
        console.error("Ошибка отправки сообщения:", result.error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages в Supabase.");
        return;
      }

      input.value = "";
      playBubbleSound();
    }

    sendBtn.onclick = send;

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });

    const { data, error } = await chatDb
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки сообщений:", error);
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          Не удалось загрузить сообщения.
        </div>
      `;
    } else if (data && data.length) {
      data.forEach(renderMessage);
    } else {
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          Пока сообщений нет. Напиши первым 🎣
        </div>
      `;
    }

    chatDb
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {
          const emptyState = messagesContainer.querySelector(".chat-empty-state");
          if (emptyState) emptyState.remove();

          renderMessage(payload.new);
        }
      )
      .subscribe();
  }

  function injectChatStyles() {
    if (document.getElementById("klevby-chat-modern-styles")) return;

    const style = document.createElement("style");
    style.id = "klevby-chat-modern-styles";

    style.textContent = `
      .klevby-chat-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10001;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .klevby-chat-modal.open {
        display: flex;
      }

      .klevby-chat-window {
        width: min(94vw, 430px);
        height: min(78vh, 620px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 26px;
        background:
          radial-gradient(circle at 10% 0%, rgba(87, 230, 178, 0.12), transparent 34%),
          radial-gradient(circle at 95% 0%, rgba(88, 183, 255, 0.10), transparent 36%),
          rgba(10, 18, 23, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.10);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.54), inset 0 1px 0 rgba(255,255,255,0.06);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      .klevby-chat-header {
        min-height: 66px;
        padding: 15px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: rgba(255,255,255,0.035);
      }

      .klevby-chat-title {
        color: #ffffff;
        font-size: 16px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.2px;
      }

      .klevby-chat-subtitle {
        margin-top: 4px;
        color: rgba(244,251,247,0.52);
        font-size: 12px;
        font-weight: 600;
      }

      .klevby-chat-close {
        width: 40px;
        height: 40px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 50%;
        background: rgba(255,255,255,0.055);
        color: rgba(255,255,255,0.72);
        cursor: pointer;
        font-size: 28px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: 0.22s ease;
      }

      .klevby-chat-close:hover {
        background: rgba(255,255,255,0.10);
        color: #ffffff;
        transform: scale(1.04);
      }

      .klevby-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        background:
          linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.18)),
          rgba(3, 11, 13, 0.72);
        display: flex;
        flex-direction: column;
        gap: 9px;
        -webkit-overflow-scrolling: touch;
      }

      .chat-message-row {
        width: 100%;
        display: flex;
        animation: chatMessageIn 0.22s ease both;
      }

      .my-message-row {
        justify-content: flex-end;
      }

      .other-message-row {
        justify-content: flex-start;
      }

      .chat-message-bubble {
        max-width: 78%;
        padding: 10px 12px 8px;
        box-shadow: 0 8px 22px rgba(0,0,0,0.18);
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .my-message {
        background: #28c990;
        color: #03150c;
        border-radius: 18px 0 18px 18px;
      }

      .other-message {
        background: rgba(255,255,255,0.075);
        color: #f4fbf7;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 0 18px 18px 18px;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .chat-message-author {
        margin-bottom: 3px;
        font-size: 11px;
        line-height: 1.2;
        font-weight: 800;
        opacity: 0.72;
      }

      .chat-message-text {
        font-size: 14px;
        line-height: 1.42;
        font-weight: 600;
        white-space: pre-wrap;
      }

      .chat-message-time {
        margin-top: 4px;
        font-size: 10px;
        line-height: 1;
        font-weight: 700;
        text-align: right;
        opacity: 0.54;
      }

      .klevby-chat-inputbar {
        padding: 10px;
        display: flex;
        gap: 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.035);
      }

      .klevby-chat-input {
        flex: 1;
        min-width: 0;
        height: 44px;
        padding: 0 13px;
        border-radius: 15px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.06);
        color: #ffffff;
        outline: none;
        font-size: 15px;
        font-weight: 600;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .klevby-chat-input::placeholder {
        color: rgba(255,255,255,0.36);
      }

      .klevby-chat-input:focus {
        border-color: rgba(87,230,178,0.38);
        box-shadow: 0 0 0 4px rgba(87,230,178,0.10);
      }

      .klevby-chat-send {
        width: 48px;
        height: 44px;
        border: 0;
        border-radius: 15px;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(87,230,178,0.20);
        transition: 0.2s ease;
      }

      .klevby-chat-send:hover {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }

      .klevby-chat-send:active {
        transform: scale(0.96);
      }

      .klevby-chat-send:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .chat-empty-state {
        margin: auto;
        max-width: 260px;
        text-align: center;
        color: rgba(244,251,247,0.56);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.5;
        padding: 20px;
      }

      @keyframes chatMessageIn {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width: 520px) {
        .klevby-chat-modal {
          align-items: flex-end;
          padding: 10px 10px calc(92px + env(safe-area-inset-bottom));
        }

        .klevby-chat-window {
          width: 100%;
          height: min(72vh, 590px);
          border-radius: 24px;
        }

        .chat-message-bubble {
          max-width: 84%;
        }

        .klevby-chat-header {
          min-height: 62px;
          padding: 13px 14px;
        }

        .klevby-chat-messages {
          padding: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
