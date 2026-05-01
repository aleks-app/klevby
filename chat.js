(function() {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  const initInterval = setInterval(() => {
    if (window.supabase) {
      clearInterval(initInterval);
      const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      setupChat(chatDb);
    }
  }, 500);

  function setupChat(chatDb) {
    let currentChatUser = null;

    chatDb.auth.getUser().then(({ data }) => {
      currentChatUser = data?.user || null;
    });

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
    });

    const chatHTML = `
      <div id="chat-desktop-btn" title="Открыть чат">💬</div>

      <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window" class="klevby-chat-window">
          <div id="chat-header" class="klevby-chat-header">
            <div>
              <div class="klevby-chat-title">Чат рыбаков 🎣</div>
              <div class="klevby-chat-subtitle">Общий разговор Klevby</div>
            </div>
            <button id="close-chat" class="klevby-chat-close">&times;</button>
          </div>

          <div id="chat-messages" class="klevby-chat-messages"></div>

          <div id="chat-input-area" class="klevby-chat-inputbar">
            <input
              type="text"
              id="message-input"
              class="klevby-chat-input"
              placeholder="Напиши сообщение..."
              autocomplete="off"
            />
            <button id="send-btn" class="klevby-chat-send">➤</button>
          </div>
        </div>
      </div>
    `;

    if (!document.getElementById("klevby-chat-modal")) {
      document.body.insertAdjacentHTML("beforeend", chatHTML);
    }

    const modal = document.getElementById("klevby-chat-modal");
    const messagesContainer = document.getElementById("chat-messages");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");

    function escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getMessageTime(createdAt) {
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
        oscillator.frequency.setValueAtTime(420, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.09);

        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.16);

        setTimeout(() => {
          audioCtx.close();
        }, 260);
      } catch (error) {
        console.warn("Звук чата не сработал:", error);
      }
    }

    function renderMessage(message) {
      if (!messagesContainer || !message) return;

      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.user_id || null;
      const isMine = myUserId && messageUserId && String(messageUserId) === String(myUserId);

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      const author = isMine ? "Вы" : (message.user_name || "Рыбак");
      const time = getMessageTime(message.created_at);

      bubble.innerHTML = `
        <div class="chat-message-author">${escapeHtml(author)}</div>
        <div class="chat-message-text">${escapeHtml(message.content || "")}</div>
        ${time ? `<div class="chat-message-time">${escapeHtml(time)}</div>` : ""}
      `;

      row.appendChild(bubble);
      messagesContainer.appendChild(row);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function clearMessages() {
      if (!messagesContainer) return;
      messagesContainer.innerHTML = "";
    }

    async function loadMessages() {
      clearMessages();

      const { data, error } = await chatDb
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        messagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Не удалось загрузить чат. Проверь таблицу messages и RLS.
          </div>
        `;
        return;
      }

      if (!data || !data.length) {
        messagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Пока сообщений нет. Напиши первым 🎣
          </div>
        `;
        return;
      }

      clearMessages();
      data.forEach(renderMessage);
    }

    async function send() {
      const val = input.value.trim();
      if (!val) return;

      sendBtn.disabled = true;

      const userId = currentChatUser?.id || null;
      const userEmail = currentChatUser?.email || "";
      const userName = userEmail ? userEmail.split("@")[0] : "Рыбак";

      const payload = {
        user_name: userName,
        content: val
      };

      if (userId) {
        payload.user_id = userId;
      }

      const { error } = await chatDb
        .from("messages")
        .insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      input.value = "";
      playBubbleSound();
    }

    function openChat() {
      modal.classList.remove("hidden");
      modal.classList.add("open");
      loadMessages();

      setTimeout(() => {
        input.focus();
      }, 150);
    }

    function closeChat() {
      modal.classList.remove("open");
      modal.classList.add("hidden");
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest("#nav-chat") || e.target.closest("#chat-desktop-btn")) {
        openChat();
      }

      if (e.target.id === "close-chat" || e.target.id === "klevby-chat-modal") {
        closeChat();
      }
    });

    sendBtn.onclick = send;

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    };

    chatDb
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const emptyState = messagesContainer.querySelector(".chat-empty-state");

          if (emptyState) {
            clearMessages();
          }

          renderMessage(payload.new);
        }
      )
      .subscribe();
  }
})();
