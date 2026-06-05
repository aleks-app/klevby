(function () {
  const POSTS_MODAL_VERSION = "20260515-posts-modal-owner-icons-align-2";

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

  function getOwnerId() {
    const state = getState();

    if (typeof state.getOwnerId === "function") {
      return state.getOwnerId();
    }

    const user =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;

    return user ? user.id : null;
  }

  function isOwnPost(post, ownerId = getOwnerId()) {
    return Boolean(ownerId && post?.owner_id && String(post.owner_id) === String(ownerId));
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
    window.open(link, "_blank", "noopener");
  }

  function ensurePostModalStyles() {
    if (document.getElementById("klevby-posts-modal-owner-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "klevby-posts-modal-owner-style";
    style.textContent = `
      .post-modal-sheet {
        position: relative;
      }

      .post-modal-close {
        position: absolute !important;
        top: 18px !important;
        right: 18px !important;
        left: auto !important;
        bottom: auto !important;
        z-index: 30 !important;
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        min-height: 46px !important;
        max-width: 46px !important;
        max-height: 46px !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 50% !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        background: rgba(18, 28, 26, 0.74) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        color: #ffffff !important;
        font-size: 30px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        transform: none !important;
        translate: none !important;
        box-shadow: 0 14px 34px rgba(0,0,0,0.38) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
      }

      .post-modal-owner-tools {
        position: absolute;
        top: 18px;
        left: 18px;
        z-index: 30;
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        margin: 0;
        padding: 0;
      }

      .post-modal-owner-icon-btn {
        width: 46px;
        height: 46px;
        min-width: 46px;
        min-height: 46px;
        max-width: 46px;
        max-height: 46px;
        margin: 0;
        padding: 0;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.18);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        color: #ffffff;
        font-size: 20px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        transform: none;
        box-shadow: 0 14px 34px rgba(0,0,0,0.36);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .post-modal-owner-edit {
        background:
          radial-gradient(circle at 30% 10%, rgba(255,255,255,0.18), transparent 42%),
          rgba(244,178,74,0.90);
        color: #1d1203;
      }

      .post-modal-owner-delete {
        background:
          radial-gradient(circle at 30% 10%, rgba(255,255,255,0.18), transparent 42%),
          rgba(219, 74, 80, 0.92);
        color: #ffffff;
      }

      .post-modal-owner-icon-btn:active,
      .post-modal-close:active {
        transform: scale(0.96) !important;
      }

      @media (max-width: 767px) {
        .post-modal-close {
          top: 16px !important;
          right: 16px !important;
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
          max-width: 44px !important;
          max-height: 44px !important;
          font-size: 29px !important;
        }

        .post-modal-owner-tools {
          top: 16px;
          left: 16px;
          gap: 9px;
        }

        .post-modal-owner-icon-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          max-width: 44px;
          max-height: 44px;
          font-size: 19px;
        }
      }

      @media (max-width: 380px) {
        .post-modal-close {
          top: 14px !important;
          right: 14px !important;
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          min-height: 42px !important;
          max-width: 42px !important;
          max-height: 42px !important;
          font-size: 28px !important;
        }

        .post-modal-owner-tools {
          top: 14px;
          left: 14px;
          gap: 8px;
        }

        .post-modal-owner-icon-btn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          min-height: 42px;
          max-width: 42px;
          max-height: 42px;
          font-size: 18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureOwnerTools(post) {
    const modal = document.getElementById("postModal");
    const sheet = modal?.querySelector(".post-modal-sheet");

    if (!sheet) return;

    let tools = sheet.querySelector(".post-modal-owner-tools");

    if (!isOwnPost(post)) {
      if (tools) {
        tools.remove();
      }

      return;
    }

    if (!tools) {
      tools = document.createElement("div");
      tools.className = "post-modal-owner-tools";
      sheet.appendChild(tools);
    }

    tools.innerHTML = "";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "post-modal-owner-icon-btn post-modal-owner-edit";
    editBtn.title = "Редактировать";
    editBtn.setAttribute("aria-label", "Редактировать объявление");
    editBtn.textContent = "✎";

    editBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      closePostModal();

      setTimeout(() => {
        if (typeof window.editPost === "function") {
          window.editPost(post.id);
        }
      }, 120);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "post-modal-owner-icon-btn post-modal-owner-delete";
    deleteBtn.title = "Удалить";
    deleteBtn.setAttribute("aria-label", "Удалить объявление");
    deleteBtn.textContent = "🗑";

    deleteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (typeof window.deletePost !== "function") {
        alert("Модуль удаления ещё не готов. Обнови страницу.");
        return;
      }

      try {
        await window.deletePost(post.id);
        closePostModal();
      } catch (error) {
        console.error("Klevby posts modal: delete failed", error);
      }
    });

    tools.appendChild(editBtn);
    tools.appendChild(deleteBtn);
  }

  function openPostModal(id) {
    ensurePostModalStyles();

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
    const tripWhenText =
      typeof window.KlevbyPostsRender?.formatTripWhen === "function"
        ? window.KlevbyPostsRender.formatTripWhen(post)
        : "Дата не указана";

    const createdAtText = post.created_at
      ? new Date(post.created_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    const fishingType = getPostFishingType(post);
    const destination = post.destination || post.city || "рыбалку";
    const ownPost = isOwnPost(post);

    imageEl.style.backgroundImage = `url('${image}')`;
    titleEl.textContent = `${post.name || "Рыбак"} едет на ${destination}`;
    textEl.textContent = post.text || "Описание не указано.";

    metaEl.innerHTML = `
      ${post.city ? `<span class="post-modal-pill">📍 Откуда: ${escapeHtml(post.city)}</span>` : ""}
      ${post.destination ? `<span class="post-modal-pill">🗺️ Куда: ${escapeHtml(post.destination)}</span>` : ""}
      <span class="post-modal-pill">🕒 Когда: ${escapeHtml(tripWhenText)}</span>
      ${fishingType ? `<span class="post-modal-pill">🎣 ${escapeHtml(fishingType)}</span>` : ""}
      ${post.transport ? `<span class="post-modal-pill">🚗 ${escapeHtml(post.transport)}</span>` : ""}
      ${post.seats ? `<span class="post-modal-pill">👥 ${escapeHtml(post.seats)}</span>` : ""}
      ${createdAtText ? `<span class="post-modal-pill">Создано: ${escapeHtml(createdAtText)}</span>` : ""}
      ${tg ? `<span class="post-modal-pill">Telegram</span>` : ""}
      ${ownPost ? `<span class="post-modal-pill">Моё объявление</span>` : ""}
    `;

    writeBtn.textContent = tg ? "Написать" : "Telegram";
    writeBtn.disabled = false;

    ensureOwnerTools(post);

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
      const tools = modal.querySelector(".post-modal-owner-tools");

      if (tools) {
        tools.remove();
      }

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
      window.open(`https://t.me/${tg}`, "_blank", "noopener");
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

  ensurePostModalStyles();

  console.log("Klevby posts modal loaded", {
    version: POSTS_MODAL_VERSION
  });
})();
