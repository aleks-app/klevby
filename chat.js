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

  function setupChat(chatDb) {
    let currentChatUser = null;
    let activeMode = "public";
    let selectedPeer = null;
    let publicSubscription = null;
    let privateSubscription = null;
    let callsSubscription = null;
    let iceSubscription = null;

    let peerConnection = null;
    let localStream = null;
    let activeCall = null;
    let currentCallRole = null;
    let pendingIceCandidates = [];
    let processedIceCandidateIds = new Set();

    const guestNameKey = "klevby_chat_guest_name";
    const sentLocalMessages = new Set();

    const rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    };

    injectExtraChatStyles();

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
        updateCallButtonVisibility();
        return currentChatUser;
      } catch (error) {
        console.warn("Не удалось проверить пользователя чата:", error);
        currentChatUser = null;
        updateCallButtonVisibility();
        return null;
      }
    }

    refreshCurrentUser();

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
      updateCallButtonVisibility();
    });

    const chatHTML = `
      <div id="chat-desktop-btn" title="Открыть чат">💬</div>

      <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window" class="klevby-chat-window">
          <div id="chat-header" class="klevby-chat-header">
            <div class="klevby-chat-heading">
              <div class="klevby-chat-title" id="chatTitle">Чат рыбаков 🎣</div>
              <div class="klevby-chat-subtitle" id="chatSubtitle">Общий разговор Klevby</div>
            </div>

            <div class="klevby-chat-header-actions">
              <button id="call-btn" class="klevby-call-btn hidden" type="button" title="Позвонить">📞</button>
              <button id="close-chat" class="klevby-chat-close" type="button">&times;</button>
            </div>
          </div>

          <div class="klevby-chat-tabs">
            <button id="publicChatTab" class="klevby-chat-tab active" type="button">Общий чат</button>
            <button id="privateChatTab" class="klevby-chat-tab" type="button">Личка</button>
          </div>

          <div id="privateChatPeople" class="klevby-private-people hidden"></div>

          <div id="callPanel" class="klevby-call-panel hidden">
            <div>
              <div id="callPanelTitle" class="klevby-call-title">Звонок</div>
              <div id="callPanelStatus" class="klevby-call-status">Подготовка...</div>
            </div>

            <div id="callPanelActions" class="klevby-call-actions">
              <button id="answer-call-btn" class="klevby-call-accept hidden" type="button">Принять</button>
              <button id="decline-call-btn" class="klevby-call-decline hidden" type="button">Отклонить</button>
              <button id="end-call-btn" class="klevby-call-end hidden" type="button">Завершить</button>
            </div>
          </div>

          <audio id="remoteAudio" autoplay playsinline></audio>

          <div id="chat-messages" class="klevby-chat-messages"></div>

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

    if (!document.getElementById("klevby-chat-modal")) {
      document.body.insertAdjacentHTML("beforeend", chatHTML);
    }

    const modal = document.getElementById("klevby-chat-modal");
    const messagesContainer = document.getElementById("chat-messages");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const publicTab = document.getElementById("publicChatTab");
    const privateTab = document.getElementById("privateChatTab");
    const privatePeople = document.getElementById("privateChatPeople");
    const chatTitle = document.getElementById("chatTitle");
    const chatSubtitle = document.getElementById("chatSubtitle");

    const callBtn = document.getElementById("call-btn");
    const callPanel = document.getElementById("callPanel");
    const callPanelTitle = document.getElementById("callPanelTitle");
    const callPanelStatus = document.getElementById("callPanelStatus");
    const answerCallBtn = document.getElementById("answer-call-btn");
    const declineCallBtn = document.getElementById("decline-call-btn");
    const endCallBtn = document.getElementById("end-call-btn");
    const remoteAudio = document.getElementById("remoteAudio");

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
      return myUserId && String(message.sender_id) === String(myUserId);
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

    function clearMessages() {
      if (!messagesContainer) return;
      messagesContainer.innerHTML = "";
    }

    function showEmptyState(text) {
      clearMessages();
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          ${escapeHtml(text)}
        </div>
      `;
    }

    function renderPublicMessage(message) {
      if (!messagesContainer || !message) return;

      const isMine = isMyPublicMessage(message);

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

    function renderPrivateMessage(message) {
      if (!messagesContainer || !message) return;

      const isMine = isMyPrivateMessage(message);

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      const author = isMine ? "Вы" : (message.sender_name || selectedPeer?.name || "Рыбак");
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

    function updateCallButtonVisibility() {
      const canShow =
        activeMode === "private" &&
        selectedPeer &&
        currentChatUser &&
        !activeCall;

      if (!callBtn) return;

      callBtn.classList.toggle("hidden", !canShow);
    }

    function showCallPanel(title, status, mode = "outgoing") {
      if (!callPanel) return;

      callPanel.classList.remove("hidden");
      callPanelTitle.textContent = title;
      callPanelStatus.textContent = status;

      answerCallBtn.classList.toggle("hidden", mode !== "incoming");
      declineCallBtn.classList.toggle("hidden", mode !== "incoming");
      endCallBtn.classList.toggle("hidden", mode === "incoming");

      updateCallButtonVisibility();
    }

    function hideCallPanel() {
      if (!callPanel) return;

      callPanel.classList.add("hidden");
      answerCallBtn.classList.add("hidden");
      declineCallBtn.classList.add("hidden");
      endCallBtn.classList.add("hidden");

      updateCallButtonVisibility();
    }

    async function getMicrophoneStream() {
      if (localStream) return localStream;

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      return localStream;
    }

    function createPeerConnection(callId) {
      const pc = new RTCPeerConnection(rtcConfig);

      pc.onicecandidate = async (event) => {
        if (!event.candidate || !currentChatUser || !callId) return;

        try {
          await chatDb
            .from("call_ice_candidates")
            .insert([{
              call_id: callId,
              user_id: currentChatUser.id,
              candidate: event.candidate.toJSON()
            }]);
        } catch (error) {
          console.warn("Не удалось отправить ICE candidate:", error);
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudio && event.streams && event.streams[0]) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;

        if (state === "connected") {
          showCallPanel("Звонок активен", "Соединение установлено", "active");
        }

        if (state === "failed" || state === "disconnected" || state === "closed") {
          if (activeCall) {
            endCall(true);
          }
        }
      };

      return pc;
    }

    async function addRemoteIceCandidate(candidateData) {
      if (!peerConnection || !candidateData) return;

      try {
        if (!peerConnection.remoteDescription) {
          pendingIceCandidates.push(candidateData);
          return;
        }

        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (error) {
        console.warn("Не удалось добавить ICE candidate:", error);
      }
    }

    async function flushPendingIceCandidates() {
      if (!peerConnection || !peerConnection.remoteDescription) return;

      const items = [...pendingIceCandidates];
      pendingIceCandidates = [];

      for (const candidate of items) {
        await addRemoteIceCandidate(candidate);
      }
    }

    async function startCall() {
      await refreshCurrentUser();

      if (!currentChatUser) {
        alert("Чтобы звонить, нужно войти или зарегистрироваться.");
        return;
      }

      if (!selectedPeer) {
        alert("Сначала выбери собеседника.");
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Звонки не поддерживаются в этом браузере.");
        return;
      }

      try {
        await endCall(false);

        showCallPanel("Звонок", "Вызываем " + selectedPeer.name + "...", "outgoing");

        const { data: callRow, error: insertError } = await chatDb
          .from("calls")
          .insert([{
            caller_id: currentChatUser.id,
            receiver_id: selectedPeer.id,
            caller_name: getCurrentChatName(),
            status: "ringing"
          }])
          .select("*")
          .single();

        if (insertError) {
          console.error(insertError);
          hideCallPanel();
          alert("Не получилось начать звонок. Проверь таблицу calls и RLS.");
          return;
        }

        activeCall = callRow;
        currentCallRole = "caller";
        pendingIceCandidates = [];
        processedIceCandidateIds = new Set();

        const stream = await getMicrophoneStream();
        peerConnection = createPeerConnection(activeCall.id);

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const { error: updateError } = await chatDb
          .from("calls")
          .update({
            offer: offer,
            status: "ringing"
          })
          .eq("id", activeCall.id);

        if (updateError) {
          console.error(updateError);
          await endCall(true);
          alert("Не получилось отправить вызов.");
          return;
        }

        activeCall.offer = offer;
      } catch (error) {
        console.error(error);
        await endCall(true);
        alert("Не получилось начать звонок. Проверь разрешение микрофона.");
      }
    }

    async function answerCall(call = activeCall) {
      await refreshCurrentUser();

      if (!currentChatUser || !call) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Звонки не поддерживаются в этом браузере.");
        return;
      }

      try {
        activeCall = call;
        currentCallRole = "receiver";
        pendingIceCandidates = [];
        processedIceCandidateIds = new Set();

        showCallPanel("Звонок", "Соединяем...", "active");

        const stream = await getMicrophoneStream();
        peerConnection = createPeerConnection(activeCall.id);

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        await peerConnection.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
        await flushPendingIceCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        const { error } = await chatDb
          .from("calls")
          .update({
            answer: answer,
            status: "active"
          })
          .eq("id", activeCall.id);

        if (error) {
          console.error(error);
          await endCall(true);
          alert("Не получилось принять звонок.");
          return;
        }

        activeCall.answer = answer;
        activeCall.status = "active";
      } catch (error) {
        console.error(error);
        await endCall(true);
        alert("Не получилось принять звонок. Проверь разрешение микрофона.");
      }
    }

    async function declineCall() {
      if (!activeCall) {
        hideCallPanel();
        return;
      }

      const callId = activeCall.id;

      try {
        await chatDb
          .from("calls")
          .update({ status: "declined" })
          .eq("id", callId);
      } catch (error) {
        console.warn("Не удалось отклонить звонок:", error);
      }

      await endCall(false);
    }

    async function endCall(updateDb = true) {
      const callId = activeCall?.id || null;

      if (updateDb && callId) {
        try {
          await chatDb
            .from("calls")
            .update({ status: "ended" })
            .eq("id", callId);
        } catch (error) {
          console.warn("Не удалось завершить звонок в базе:", error);
        }
      }

      if (peerConnection) {
        try {
          peerConnection.onicecandidate = null;
          peerConnection.ontrack = null;
          peerConnection.onconnectionstatechange = null;
          peerConnection.close();
        } catch (error) {
          console.warn("Ошибка закрытия PeerConnection:", error);
        }
      }

      peerConnection = null;

      if (localStream) {
        try {
          localStream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.warn("Ошибка остановки микрофона:", error);
        }
      }

      localStream = null;

      if (remoteAudio) {
        remoteAudio.srcObject = null;
      }

      activeCall = null;
      currentCallRole = null;
      pendingIceCandidates = [];
      processedIceCandidateIds = new Set();

      hideCallPanel();
      updateCallButtonVisibility();
    }

    async function handleCallChange(call) {
      await refreshCurrentUser();

      if (!currentChatUser || !call) return;

      const myId = String(currentChatUser.id);
      const callerId = String(call.caller_id);
      const receiverId = String(call.receiver_id);
      const isParticipant = callerId === myId || receiverId === myId;

      if (!isParticipant) return;

      if (call.status === "ended" || call.status === "declined") {
        if (activeCall && String(activeCall.id) === String(call.id)) {
          await endCall(false);
        }

        return;
      }

      if (
        receiverId === myId &&
        call.status === "ringing" &&
        call.offer &&
        (!activeCall || String(activeCall.id) !== String(call.id))
      ) {
        activeCall = call;
        currentCallRole = "receiver";
        showCallPanel("Входящий звонок", "Звонит " + (call.caller_name || "Рыбак"), "incoming");
        return;
      }

      if (
        callerId === myId &&
        activeCall &&
        String(activeCall.id) === String(call.id) &&
        call.status === "active" &&
        call.answer &&
        peerConnection &&
        !peerConnection.remoteDescription
      ) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(call.answer));
          activeCall = call;
          await flushPendingIceCandidates();
          showCallPanel("Звонок активен", "Соединение установлено", "active");
        } catch (error) {
          console.error("Не удалось принять answer:", error);
          await endCall(true);
        }
      }
    }

    async function checkIncomingCalls() {
      await refreshCurrentUser();

      if (!currentChatUser || activeCall) return;

      try {
        const { data, error } = await chatDb
          .from("calls")
          .select("*")
          .eq("receiver_id", currentChatUser.id)
          .eq("status", "ringing")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.warn("Не удалось проверить входящие звонки:", error);
          return;
        }

        if (data && data[0]) {
          await handleCallChange(data[0]);
        }
      } catch (error) {
        console.warn("Ошибка проверки входящих звонков:", error);
      }
    }

    async function handleIceCandidateRow(row) {
      await refreshCurrentUser();

      if (!currentChatUser || !activeCall || !row) return;
      if (String(row.call_id) !== String(activeCall.id)) return;
      if (String(row.user_id) === String(currentChatUser.id)) return;
      if (processedIceCandidateIds.has(String(row.id))) return;

      processedIceCandidateIds.add(String(row.id));
      await addRemoteIceCandidate(row.candidate);
    }

    async function loadPublicMessages() {
      activeMode = "public";
      selectedPeer = null;

      publicTab.classList.add("active");
      privateTab.classList.remove("active");
      privatePeople.classList.add("hidden");

      chatTitle.textContent = "Чат рыбаков 🎣";
      chatSubtitle.textContent = "Общий разговор Klevby";
      input.placeholder = "Напиши сообщение...";

      updateCallButtonVisibility();
      clearMessages();

      const { data, error } = await chatDb
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        showEmptyState("Не удалось загрузить общий чат. Проверь таблицу messages и RLS.");
        return;
      }

      if (!data || !data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        return;
      }

      clearMessages();
      data.forEach(renderPublicMessage);
    }

    async function loadPrivatePeople() {
      await refreshCurrentUser();

      activeMode = "private";

      publicTab.classList.remove("active");
      privateTab.classList.add("active");
      privatePeople.classList.remove("hidden");

      chatTitle.textContent = "Личные сообщения";
      chatSubtitle.textContent = currentChatUser ? "Выбери собеседника" : "Для лички нужен вход";
      input.placeholder = "Выбери собеседника...";
      selectedPeer = null;

      updateCallButtonVisibility();
      clearMessages();
      privatePeople.innerHTML = "";

      if (!currentChatUser) {
        showEmptyState("Чтобы пользоваться личными сообщениями, войди или зарегистрируйся на сайте.");
        return;
      }

      const peersMap = new Map();

      try {
        const { data: publicUsers } = await chatDb
          .from("messages")
          .select("user_id,user_name")
          .not("user_id", "is", null);

        (publicUsers || []).forEach((item) => {
          if (!item.user_id) return;
          if (String(item.user_id) === String(currentChatUser.id)) return;

          peersMap.set(String(item.user_id), {
            id: item.user_id,
            name: item.user_name || "Рыбак"
          });
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из общего чата:", error);
      }

      try {
        const { data: postUsers } = await chatDb
          .from("posts")
          .select("owner_id,name")
          .not("owner_id", "is", null);

        (postUsers || []).forEach((item) => {
          if (!item.owner_id) return;
          if (String(item.owner_id) === String(currentChatUser.id)) return;

          if (!peersMap.has(String(item.owner_id))) {
            peersMap.set(String(item.owner_id), {
              id: item.owner_id,
              name: item.name || "Рыбак"
            });
          }
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из объявлений:", error);
      }

      const peers = Array.from(peersMap.values());

      if (!peers.length) {
        privatePeople.innerHTML = "";
        showEmptyState("Пока нет собеседников. Пользователь должен быть автором объявления или написать в общий чат.");
        return;
      }

      privatePeople.innerHTML = peers.map(peer => `
        <button class="klevby-private-person" type="button" data-peer-id="${escapeHtml(peer.id)}" data-peer-name="${escapeHtml(peer.name)}">
          <span class="klevby-private-avatar">🎣</span>
          <span class="klevby-private-name">${escapeHtml(peer.name)}</span>
        </button>
      `).join("");

      showEmptyState("Выбери рыбака сверху, чтобы открыть личную переписку.");
    }

    async function openPrivateDialog(peerId, peerName) {
      await refreshCurrentUser();

      if (!currentChatUser) {
        showEmptyState("Для личных сообщений нужно войти.");
        return;
      }

      selectedPeer = {
        id: peerId,
        name: peerName || "Рыбак"
      };

      chatTitle.textContent = "Личка";
      chatSubtitle.textContent = "Диалог с " + selectedPeer.name;
      input.placeholder = "Напиши личное сообщение...";

      document.querySelectorAll(".klevby-private-person").forEach((button) => {
        button.classList.toggle("active", String(button.dataset.peerId) === String(peerId));
      });

      updateCallButtonVisibility();
      clearMessages();

      const { data, error } = await chatDb
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentChatUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentChatUser.id})`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        showEmptyState("Не удалось загрузить личку. Проверь таблицу private_messages и RLS.");
        return;
      }

      if (!data || !data.length) {
        showEmptyState("Личных сообщений пока нет. Напиши первым.");
        return;
      }

      clearMessages();
      data.forEach(renderPrivateMessage);
    }

    async function sendPublicMessage() {
      const val = input.value.trim();
      if (!val) return;

      await refreshCurrentUser();

      sendBtn.disabled = true;

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

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      input.value = "";
      playBubbleSound();

      setTimeout(() => {
        sentLocalMessages.delete(`${userName}__${val}`);
      }, 30000);
    }

    async function sendPrivateMessage() {
      const val = input.value.trim();
      if (!val) return;

      await refreshCurrentUser();

      if (!currentChatUser) {
        alert("Для личных сообщений нужно войти.");
        return;
      }

      if (!selectedPeer) {
        alert("Сначала выбери собеседника.");
        return;
      }

      sendBtn.disabled = true;

      const payload = {
        sender_id: currentChatUser.id,
        receiver_id: selectedPeer.id,
        sender_name: getCurrentChatName(),
        content: val
      };

      const { error } = await chatDb
        .from("private_messages")
        .insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return;
      }

      input.value = "";
      playBubbleSound();
    }

    async function send() {
      if (activeMode === "private") {
        await sendPrivateMessage();
      } else {
        await sendPublicMessage();
      }
    }

    async function openChat() {
      modal.classList.remove("hidden");
      modal.classList.add("open");

      await refreshCurrentUser();
      await checkIncomingCalls();
      await loadPublicMessages();

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

      if (e.target.closest("#publicChatTab")) {
        await loadPublicMessages();
      }

      if (e.target.closest("#privateChatTab")) {
        await loadPrivatePeople();
      }

      const personButton = e.target.closest(".klevby-private-person");
      if (personButton) {
        await openPrivateDialog(personButton.dataset.peerId, personButton.dataset.peerName);
      }

      if (e.target.closest("#call-btn")) {
        await startCall();
      }

      if (e.target.closest("#answer-call-btn")) {
        await answerCall(activeCall);
      }

      if (e.target.closest("#decline-call-btn")) {
        await declineCall();
      }

      if (e.target.closest("#end-call-btn")) {
        await endCall(true);
      }
    });

    sendBtn.onclick = send;

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    };

    publicSubscription = chatDb
      .channel("public_messages_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          if (activeMode !== "public") return;

          const emptyState = messagesContainer.querySelector(".chat-empty-state");
          if (emptyState) clearMessages();

          await refreshCurrentUser();
          renderPublicMessage(payload.new);
        }
      )
      .subscribe();

    privateSubscription = chatDb
      .channel("private_messages_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        async (payload) => {
          await refreshCurrentUser();

          if (!currentChatUser || activeMode !== "private" || !selectedPeer) return;

          const msg = payload.new;
          const myId = String(currentChatUser.id);
          const peerId = String(selectedPeer.id);

          const belongsToDialog =
            (String(msg.sender_id) === myId && String(msg.receiver_id) === peerId) ||
            (String(msg.sender_id) === peerId && String(msg.receiver_id) === myId);

          if (!belongsToDialog) return;

          const emptyState = messagesContainer.querySelector(".chat-empty-state");
          if (emptyState) clearMessages();

          renderPrivateMessage(msg);
        }
      )
      .subscribe();

    callsSubscription = chatDb
      .channel("calls_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        async (payload) => {
          await handleCallChange(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        async (payload) => {
          await handleCallChange(payload.new);
        }
      )
      .subscribe();

    iceSubscription = chatDb
      .channel("call_ice_candidates_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_ice_candidates" },
        async (payload) => {
          await handleIceCandidateRow(payload.new);
        }
      )
      .subscribe();

    window.addEventListener("beforeunload", () => {
      if (activeCall) {
        endCall(true);
      }
    });
  }

  function injectExtraChatStyles() {
    if (document.getElementById("klevby-chat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "klevby-chat-extra-styles";
    style.textContent = `
      #chat-input-area,
      .klevby-chat-inputbar {
        align-items: center !important;
      }

      #send-btn,
      .klevby-chat-send {
        flex: 0 0 48px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #message-input,
      .klevby-chat-input {
        margin: 0 !important;
      }

      .klevby-chat-heading {
        min-width: 0;
        flex: 1;
      }

      .klevby-chat-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .klevby-call-btn {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 50%;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 26px rgba(87, 230, 178, 0.22);
        transition: 0.2s ease;
      }

      .klevby-call-btn:hover {
        transform: scale(1.04);
        filter: brightness(1.04);
      }

      .klevby-call-btn.hidden {
        display: none !important;
      }

      .klevby-call-panel {
        padding: 12px 14px;
        background:
          radial-gradient(circle at 10% 0%, rgba(87,230,178,0.14), transparent 40%),
          rgba(255,255,255,0.045);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .klevby-call-panel.hidden {
        display: none !important;
      }

      .klevby-call-title {
        color: #ffffff;
        font-size: 14px;
        line-height: 1.1;
        font-weight: 900;
      }

      .klevby-call-status {
        margin-top: 3px;
        color: rgba(244,251,247,0.62);
        font-size: 12px;
        line-height: 1.2;
        font-weight: 700;
      }

      .klevby-call-actions {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .klevby-call-accept,
      .klevby-call-decline,
      .klevby-call-end {
        min-height: 36px;
        padding: 0 12px;
        border: 0;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
      }

      .klevby-call-accept {
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
      }

      .klevby-call-decline,
      .klevby-call-end {
        background: rgba(228,88,88,0.92);
        color: #ffffff;
      }

      .klevby-call-accept.hidden,
      .klevby-call-decline.hidden,
      .klevby-call-end.hidden {
        display: none !important;
      }

      #remoteAudio {
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
        position: absolute;
      }

      .klevby-chat-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 10px;
        background: rgba(255,255,255,0.025);
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }

      .klevby-chat-tab {
        min-height: 38px;
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
        border-color: rgba(87,230,178,0.28);
      }

      .klevby-private-people {
        display: flex;
        gap: 8px;
        padding: 10px;
        overflow-x: auto;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.025);
        -webkit-overflow-scrolling: touch;
      }

      .klevby-private-person {
        flex: 0 0 auto;
        min-height: 42px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.055);
        color: #f4fbf7;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }

      .klevby-private-person.active {
        background: rgba(87,230,178,0.16);
        border-color: rgba(87,230,178,0.32);
        color: #d7ffe8;
      }

      .klevby-private-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(87,230,178,0.14);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .klevby-private-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: 768px) {
        .klevby-call-panel {
          align-items: flex-start;
          flex-direction: column;
        }

        .klevby-call-actions {
          width: 100%;
        }

        .klevby-call-accept,
        .klevby-call-decline,
        .klevby-call-end {
          flex: 1;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
