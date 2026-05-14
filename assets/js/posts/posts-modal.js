(function () {
  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getUtils() {
    return window.KlevbyPostsUtils || {};
  }

  function getPostsArray() {
    const state = getState();

    if (typeof state.getPostsArray === "function") {
      return state.getPostsArray();
    }

    if (Array.isArray(window.posts)) {
      return window.posts;
    }

    if (Array.isArray(window.klevbyPosts)) {
      return window.klevbyPosts;
    }

    return [];
  }

  function setActiveModalPost(value) {
    const state = getState();

    if (typeof state.setActiveModalPost === "function") {
      state.setActiveModalPost(value);
      return;
    }

    window.klevbyActiveModalPost = value;
  }

  function getActiveModalPost() {
    const state = getState();

    if (typeof state.getActiveModalPost === "function") {
      return state.getActiveModalPost();
    }

    return window.klevbyActiveModalPost || null;
  }

  function getPostModalCloseTimer() {
    const state = getState();

    if (typeof state.getPostModalCloseTimer === "function") {
      return state.getPostModalCloseTimer();
    }

    return window.klevbyPostModalCloseTimer || null;
  }

  function setPostModalCloseTimer(value) {
    const state = getState();

    if (typeof state.setPostModalCloseTimer === "function") {
      state.setPostModalCloseTimer(value);
      return;
    }

    window.klevbyPostModalCloseTimer = value;
  }

  function cleanTelegram(value) {
    const utils = getUtils();

    if (typeof utils.cleanTelegram === "function") {
      return utils.cleanTelegram(value);
    }

    let v = String(value || "").trim();

    v = v.replace(/^@/, "");
    v = v.replace(/^https?:\/\/t\.me\//i, "");
    v = v.replace(/^https?:\/\/telegram\.me\//i, "");
    v = v.replace(/^t\.me\//i, "");
    v = v.split("?")[0];
    v = v.split("/")[0];
    v = v.replace(/[^a-zA-Z0-9_]/g, "");

    return v;
  }

  function escapeHtml(value) {
    const utils = getUtils();

    if (typeof utils.escapeHtml === "function") {
      return utils.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getPostFishingType(post) {
    const utils = getUtils();

    if (typeof utils.getPostFishingType === "function") {
      return utils.getPostFishingType(post);
    }

    return post?.fishing_type || post?.type || post?.category || "";
  }

  function getCardImage(post) {
    const utils = getUtils();

    if (typeof utils.getCardImage === "function") {
      return utils.getCardImage(post);
    }

    return "assets/img/klevby-icon-512.png";
  }

  function openTelegramSafe() {
    const utils = getUtils();

    if (typeof utils.openTelegramSafe === "function") {
      utils.openTelegramSafe();
      return;
    }

    if (typeof window.openTelegram === "function") {
      window.openTelegram();
      return;
    }

    const config = window.KLEVB_CONFIG || {};
    const link = config.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
    window.open(link, "_blank");
  }

  function openPostModal(id) {
    const post = getPostsArray().find((item) => String(item.id) === String(id));
    if (!post) return;

    setActiveModalPost(post);

    const modal = document.getElementById("postModal");
    const imageEl = document.getElementById("postModalImage");
    const titleEl = document.getElementById("postModalTitle");
    const metaEl = document.getElementById("postModalMeta");
    const textEl = document.getElementById("postModalText");
    const writeBtn = document.getElementById("postModalWriteBtn");

    if (!modal || !imageEl || !titleEl || !metaEl || !textEl || !writeBtn) return;

    const image = getCardImage(post);
    const tg = cleanTelegram(post.telegram);
    const isFull = Boolean(post.crew_full);
    const date = post.created_at
      ? new Date(post.created_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    const fishingType = getPostFishingType(post);
    const destination = post.destination || post.city || "рыбалку";

    imageEl.style.backgroundImage = `url('${image}')`;
    titleEl.textContent = `${post.name || "Рыбак"} едет на ${destination}`;
    textEl.textContent = post.text || "Описание не указано.";

    metaEl.innerHTML = `
      ${post.city ? `<span class="post-modal-pill">📍 Откуда: ${escapeHtml(post.city)}</span>` : ""}
      ${post.destination ? `<span class="post-modal-pill">🗺️ Куда: ${escapeHtml(post.destination)}</span>` : ""}
      ${post.trip_time ? `<span class="post-modal-pill">🕒 Когда: ${escapeHtml(post.trip_time)}</span>` : ""}
      ${fishingType ? `<span class="post-modal-pill">🎣 ${escapeHtml(fishingType)}</span>` : ""}
      ${post.transport ? `<span class="post-modal-pill">🚗 ${escapeHtml(post.transport)}</span>` : ""}
      ${post.seats ? `<span class="post-modal-pill">👥 ${escapeHtml(post.seats)}</span>` : ""}
      ${date ? `<span class="post-modal-pill">Создано: ${escapeHtml(date)}</span>` : ""}
      ${tg ? `<span class="post-modal-pill">Telegram</span>` : ""}
      ${isFull ? `<span class="post-modal-pill">Экипаж набран</span>` : ""}
    `;

    if (isFull) {
      writeBtn.textContent = "Экипаж уже набран";
      writeBtn.disabled = true;
    } else {
      writeBtn.textContent = "Написать";
      writeBtn.disabled = false;
    }

    clearTimeout(getPostModalCloseTimer());
    modal.classList.remove("hidden");

    requestAnimationFrame(() => {
      modal.classList.add("open");
      document.body.classList.add("post-modal-open");
    });
  }

  function closePostModal() {
    const modal = document.getElementById("postModal");
    if (!modal) return;

    modal.classList.remove("open");
    document.body.classList.remove("post-modal-open");

    const timer = setTimeout(() => {
      modal.classList.add("hidden");
      setActiveModalPost(null);
    }, 360);

    setPostModalCloseTimer(timer);
  }

  function handlePostModalBackdrop(event) {
    if (event.target && event.target.id === "postModal") {
      closePostModal();
    }
  }

  function writePostAuthor() {
    const post = getActiveModalPost();
    if (!post) return;

    const tg = cleanTelegram(post.telegram);

    if (tg) {
      window.open(`https://t.me/${tg}`, "_blank");
    } else {
      openTelegramSafe();
    }
  }

  window.KlevbyPostsModal = {
    openPostModal,
    closePostModal,
    handlePostModalBackdrop,
    writePostAuthor
  };

  console.log("Klevby posts modal loaded", {
    version: "20260514-posts-modal-split-1"
  });
})();
