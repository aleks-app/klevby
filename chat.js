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
    let chatReady = false;
    let activeMode = "public";
    let selectedPrivateUser = null;
    let privateChannel = null;

    const guestNameKey = "klevby_chat_guest_name";
    const sentLocalMessages = new Set();

    function injectPrivateChatStyles() {
      if (document.getElementById("klevby-private-chat-style")) return;

      const style = document.createElement("style");
      style.id = "klevby-private-chat-style";
      style.textContent = `
        .klevby-chat-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 10px;
          background: rgba(255,255,255,0.028);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .klevby-chat-tab {
          height: 38px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          background: rgba(255,255,255,0.055);
          color: rgba(244,251,247,0.62);
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .klevby-chat-tab.active {
          background: linear-gradient(135deg, #57e6b2, #28c990);
          color: #03150c;
          border-color: rgba(87,230,178,0.35);
          box-shadow: 0 10px 26px rgba(87,230,178,0.18);
        }

        .klevby-private-layout {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 140px 1fr;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.18)),
            rgba(3,11,13,0.72);
        }

        .klevby-contacts {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .klevby-contact-btn {
          width: 100%;
          min-height: 44px;
          padding: 9px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          background: rgba(255,255,255,0.055);
          color: rgba(244,251,247,0.82);
          font-size: 12px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .klevby-contact-btn.active {
          background: rgba(87,230,178,0.16);
          border-color: rgba(87,230,178,0.28);
          color: #d8fff0;
        }

        .klevby-private-side-empty {
          padding: 14px 8px;
          color: rgba(244,251,247,0.48);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.4;
        }

        .klevby-private-main {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .klevby-private-top {
          min-height: 44px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: rgba(244,251,247,0.74);
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
        }

        #private-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          -webkit-overflow-scrolling: touch;
        }

        .klevby-mode-hidden {
          display: none !important;
        }

        #chat-input-area,
        .klevby-chat-inputbar {
          align-items: center;
        }

        #send-btn,
        .klevby-chat-send {
          flex: 0 0 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0;
        }

        @media (max-width: 768px) {
          .klevby-private-layout {
            grid-template-columns: 112px 1fr;
          }

          .klevby-contacts {
            padding: 8px;
          }

          .klevby-contact-btn {
            min-height: 42px;
            padding: 8px;
            font-size: 11px;
            border-radius: 13px;
          }

          .klevby-private-top {
            min-height: 40px;
            padding: 9px 10px;
            font-size: 11px;
          }

          #private-messages {
            padding: 10px;
          }
        }
      `;

      document.head.appendChild(style);
    }

    injectPrivateChatStyles();

    function getGuestName() {
      let name = localStorage.getItem(guestNameKey);

      if (!name) {
        name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem(guestNameKey, name);
      }

      return name;
    }

    async function refreshCurrentUser() {
      try {
        const { data } = await chatDb.auth.getUser();
        currentChatUser = data?.user || null;
        chatReady = true;
        return currentChatUser;
      } catch (error) {
        console.warn("Не удалось проверить пользователя чата:", error);
        currentChatUser = null;
        chatReady = true;
        return null;
      }
    }

    refreshCurrentUser();

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
      chatReady = true;
    });

    const chatHTML = `
      <div id="chat-desktop-btn" title="Открыть чат">💬</div>

      <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window" class="klevby-chat-window">
          <div id="chat-header" class="klevby-chat-header">
            <div>
              <div class="klevby-chat-title">Чат рыбаков 🎣</div>
              <div class="klevby-chat-subtitle" id="chat-subtitle">Общий разговор Klevby</div>
            </div>
            <button id="close-chat" class="klevby-chat-close">&times;</button>
          </div>

          <div class="klevby-chat-tabs">
            <button id="public-chat-tab" class="klevby-chat-tab active" type="button">Общий чат</button>
            <button id="private-chat-tab" class="klevby-chat-tab" type="button">Личка</button>
          </div>

          <div id="public-chat-view" class="klevby-public-view" style="flex:1;min-height:0;display:flex;flex-direction:column;">
            <div id="chat-messages" class="klevby-chat-messages"></div>
          </div>

          <div id="private-chat-view" class="klevby-private-layout klevby-mode-hidden">
            <div id="private-users" class="klevby-contacts"></div>

            <div class="klevby-private-main">
              <div id="private-chat-title" class="klevby-private-top">Выбери рыбака для личной переписки</div>
              <div id="private-messages"></div>
            </div>
          </div>

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
    const privateMessagesContainer = document.getElementById("private-messages");
    const privateUsersContainer = document.getElementById("private-users");
    const privateChatTitle = document.getElementById("private-chat-title");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const publicTab = document.getElementById("public-chat-tab");
    const privateTab = document.getElementById("private-chat-tab");
    const publicView = document.getElementById("public-chat-view");
    const privateView = document.getElementById("private-chat-view");
    const chatSubtitle = document.getElementById("chat-subtitle");

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

    function getCurrentChatName() {
      const userEmail = currentChatUser?.email || "";

      if (userEmail) {
        return userEmail.split("@")[0];
      }

      return getGuestName();
    }

    function getLocalMessageKey(message) {
      return `${message.user_name || ""}__${message.content || ""}`;
    }

    function isMyPublicMessage(message) {
      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.user_id || null;

      if (myUserId && messageUserId && String(messageUserId) === String(myUserId)) {
        return true;
      }

      const localName = getCurrentChatName();
      const messageName = message.user_name || "";

      if (!messageUserId && messageName && messageName === localName) {
        return true;
      }

      const localKey = getLocalMessageKey(message);

      if (sentLocalMessages.has(localKey)) {
        return true;
      }

      return false;
    }

    function isMyPrivateMessage(message) {
      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.sender_id || null;

      return Boolean(myUserId && messageUserId && String(messageUserId) === String(myUserId));
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

    function renderBubble(container, message, isMine, authorName, textValue) {
      if (!container || !message) return;

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      const author = isMine ? "Вы" : (authorName || "Рыбак");
      const time = getMessageTime(message.created_at);

      bubble.innerHTML = `
        <div class="chat-message-author">${escapeHtml(author)}</div>
        <div class="chat-message-text">${escapeHtml(textValue || "")}</div>
        ${time ? `<div class="chat-message-time">${escapeHtml(time)}</div>` : ""}
      `;

      row.appendChild(bubble);
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
    }

    function renderPublicMessage(message) {
      renderBubble(
        messagesContainer,
        message,
        isMyPublicMessage(message),
        message.user_name || "Рыбак",
        message.content || ""
      );
    }

    function renderPrivateMessage(message) {
      renderBubble(
        privateMessagesContainer,
        message,
        isMyPrivateMessage(message),
        message.sender_name || "Рыбак",
        message.content || ""
      );
    }

    function clearPublicMessages() {
      if (!messagesContainer) return;
      messagesContainer.innerHTML = "";
    }

    function clearPrivateMessages() {
      if (!privateMessagesContainer) return;
      privateMessagesContainer.innerHTML = "";
    }

    async function loadPublicMessages() {
      await refreshCurrentUser();
      clearPublicMessages();

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

      data.forEach(renderPublicMessage);
    }

    async function loadPrivateUsers() {
      await refreshCurrentUser();

      if (!currentChatUser) {
        privateUsersContainer.innerHTML = `
          <div class="klevby-private-side-empty">
            Для лички нужно войти в аккаунт.
          </div>
        `;
        clearPrivateMessages();
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Войди на сайт, чтобы писать личные сообщения.
          </div>
        `;
        return;
      }

      const { data, error } = await chatDb
        .from("messages")
        .select("user_id, user_name")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        privateUsersContainer.innerHTML = `
          <div class="klevby-private-side-empty">
            Не удалось загрузить рыбаков.
          </div>
        `;
        return;
      }

      const usersMap = new Map();

      (data || []).forEach(item => {
        if (!item.user_id) return;
        if (String(item.user_id) === String(currentChatUser.id)) return;

        if (!usersMap.has(item.user_id)) {
          usersMap.set(item.user_id, {
            id: item.user_id,
            name: item.user_name || "Рыбак"
          });
        }
      });

      const users = Array.from(usersMap.values());

      if (!users.length) {
        privateUsersContainer.innerHTML = `
          <div class="klevby-private-side-empty">
            Пока нет пользователей для лички. Когда кто-то напишет в общий чат, он появится здесь.
          </div>
        `;
        clearPrivateMessages();
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Некому написать. Пользователи появятся после сообщений в общем чате.
          </div>
        `;
        return;
      }

      privateUsersContainer.innerHTML = users.map(user => `
        <button
          class="klevby-contact-btn ${selectedPrivateUser && selectedPrivateUser.id === user.id ? "active" : ""}"
          data-user-id="${escapeHtml(user.id)}"
          data-user-name="${escapeHtml(user.name)}"
          type="button"
        >
          ${escapeHtml(user.name)}
        </button>
      `).join("");

      if (!selectedPrivateUser) {
        selectedPrivateUser = users[0];
        await loadPrivateDialog();
      }
    }

    async function loadPrivateDialog() {
      await refreshCurrentUser();

      if (!currentChatUser) {
        clearPrivateMessages();
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Войди на сайт, чтобы писать личные сообщения.
          </div>
        `;
        return;
      }

      if (!selectedPrivateUser) {
        clearPrivateMessages();
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Выбери рыбака слева.
          </div>
        `;
        return;
      }

      privateChatTitle.textContent = `Личка с ${selectedPrivateUser.name}`;
      clearPrivateMessages();

      const myId = currentChatUser.id;
      const otherId = selectedPrivateUser.id;

      const { data, error } = await chatDb
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Не удалось загрузить личку. Проверь таблицу private_messages и RLS.
          </div>
        `;
        return;
      }

      if (!data || !data.length) {
        privateMessagesContainer.innerHTML = `
          <div class="chat-empty-state">
            Личных сообщений пока нет. Напиши первым.
          </div>
        `;
        return;
      }

      data.forEach(renderPrivateMessage);
    }

    function updateModeUI() {
      const isPublic = activeMode === "public";

      publicTab.classList.toggle("active", isPublic);
      privateTab.classList.toggle("active", !isPublic);

      publicView.classList.toggle("klevby-mode-hidden", !isPublic);
      privateView.classList.toggle("klevby-mode-hidden", isPublic);

      chatSubtitle.textContent = isPublic
        ? "Общий разговор Klevby"
        : "Личные сообщения";

      input.placeholder = isPublic
        ? "Напиши сообщение..."
        : selectedPrivateUser
          ? `Написать ${selectedPrivateUser.name}...`
          : "Выбери рыбака...";
    }

    async function switchMode(mode) {
      activeMode = mode;
      updateModeUI();

      if (mode === "public") {
        await loadPublicMessages();
      } else {
        await loadPrivateUsers();
        await loadPrivateDialog();
      }

      setTimeout(() => input.focus(), 120);
    }

    async function sendPublicMessage(val) {
      await refreshCurrentUser();

      const userId = currentChatUser?.id || null;
      const userName = getCurrentChatName();

      const payload = {
        user_name: userName,
        content: val
      };

      if (userId) {
        payload.user_id = userId;
      }

      sentLocalMessages.add(`${userName}__${val}`);

      const { error } = await chatDb
        .from("messages")
        .insert([payload]);

      if (error) {
        console.error(error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return false;
      }

      setTimeout(() => {
        sentLocalMessages.delete(`${userName}__${val}`);
      }, 30000);

      return true;
    }

    async function sendPrivateMessage(val) {
      await refreshCurrentUser();

      if (!currentChatUser) {
        alert("Для личных сообщений нужно войти в аккаунт.");
        return false;
      }

      if (!selectedPrivateUser) {
        alert("Выбери рыбака для личной переписки.");
        return false;
      }

      const payload = {
        sender_id: currentChatUser.id,
        receiver_id: selectedPrivateUser.id,
        sender_name: getCurrentChatName(),
        content: val
      };

      const { error } = await chatDb
        .from("private_messages")
        .insert([payload]);

      if (error) {
        console.error(error);
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return false;
      }

      return true;
    }

    async function send() {
      const val = input.value.trim();
      if (!val) return;

      sendBtn.disabled = true;

      const ok = activeMode === "public"
        ? await sendPublicMessage(val)
        : await sendPrivateMessage(val);

      sendBtn.disabled = false;

      if (!ok) return;

      input.value = "";
      playBubbleSound();
    }

    async function openChat() {
      modal.classList.remove("hidden");
      modal.classList.add("open");

      updateModeUI();

      if (activeMode === "public") {
        await loadPublicMessages();
      } else {
        await loadPrivateUsers();
        await loadPrivateDialog();
      }

      setTimeout(() => {
        input.focus();
      }, 150);
    }

    function closeChat() {
      modal.classList.remove("open");
      modal.classList.add("hidden");
    }

    document.addEventListener("click", async (e) => {
      if (e.target.closest("#nav-chat") || e.target.closest("#chat-desktop-btn")) {
        openChat();
      }

      if (e.target.id === "close-chat" || e.target.id === "klevby-chat-modal") {
        closeChat();
      }

      if (e.target.closest("#public-chat-tab")) {
        await switchMode("public");
      }

      if (e.target.closest("#private-chat-tab")) {
        await switchMode("private");
      }

      const contactBtn = e.target.closest(".klevby-contact-btn");

      if (contactBtn) {
        selectedPrivateUser = {
          id: contactBtn.dataset.userId,
          name: contactBtn.dataset.userName || "Рыбак"
        };

        document.querySelectorAll(".klevby-contact-btn").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.userId === selectedPrivateUser.id);
        });

        updateModeUI();
        await loadPrivateDialog();
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
      .channel("public_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          if (!chatReady) {
            await refreshCurrentUser();
          }

          if (activeMode !== "public") {
            return;
          }

          const emptyState = messagesContainer.querySelector(".chat-empty-state");

          if (emptyState) {
            clearPublicMessages();
          }

          renderPublicMessage(payload.new);
        }
      )
      .subscribe();

    chatDb
      .channel("private_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        async (payload) => {
          await refreshCurrentUser();

          if (!currentChatUser || activeMode !== "private" || !selectedPrivateUser) {
            return;
          }

          const msg = payload.new;
          const myId = String(currentChatUser.id);
          const otherId = String(selectedPrivateUser.id);

          const belongsToDialog =
            (String(msg.sender_id) === myId && String(msg.receiver_id) === otherId) ||
            (String(msg.sender_id) === otherId && String(msg.receiver_id) === myId);

          if (!belongsToDialog) {
            return;
          }

          const emptyState = privateMessagesContainer.querySelector(".chat-empty-state");

          if (emptyState) {
            clearPrivateMessages();
          }

          renderPrivateMessage(msg);
        }
      )
      .subscribe();
  }
})();
