(function () {
  const KLEVB_FEED_PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_FEED_PROFILE_SETTINGS_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";

  let klevbyFeedRenderToken = 0;
  let klevbyFeedLastItems = [];
  let klevbyFeedItemsCache = {};
  let klevbyFeedAutoRefreshTimer = null;
  let klevbyFeedRealtimeStarted = false;

  function klevbyFeedEscapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function klevbyFeedEscapeAttr(value) {
    return klevbyFeedEscapeHtml(value).replaceAll("`", "&#096;");
  }

  function klevbyFeedNormalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function klevbyFeedCleanTelegram(value) {
    let cleanValue = String(value || "").trim();

    cleanValue = cleanValue.replace(/^@/, "");
    cleanValue = cleanValue.replace(/^https?:\/\/t\.me\//i, "");
    cleanValue = cleanValue.replace(/^https?:\/\/telegram\.me\//i, "");
    cleanValue = cleanValue.replace(/^t\.me\//i, "");
    cleanValue = cleanValue.split("?")[0];
    cleanValue = cleanValue.split("/")[0];
    cleanValue = cleanValue.replace(/[^a-zA-Z0-9_]/g, "");

    return cleanValue;
  }

  function klevbyFeedGetCurrentUser() {
    return (
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null
    );
  }

  function klevbyFeedIsAdmin() {
    if (typeof window.isAdmin === "function") {
      try {
        return Boolean(window.isAdmin());
      } catch (error) {
        return false;
      }
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function klevbyFeedReadProfileData() {
    try {
      const raw = localStorage.getItem(KLEVB_FEED_PROFILE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const user = klevbyFeedGetCurrentUser();
      const meta = user?.user_metadata || {};

      const fallbackName =
        parsed.name ||
        localStorage.getItem(KLEVB_FEED_PROFILE_NAME_KEY) ||
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        "Рыбак";

      return {
        name: String(fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim()
      };
    } catch (error) {
      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: ""
      };
    }
  }

  function klevbyGetProfileFeedItemsSafe() {
    try {
      if (typeof window.getProfileFeedItems === "function") {
        const items = window.getProfileFeedItems();

        return Array.isArray(items)
          ? items
              .filter(Boolean)
              .map((item) => ({
                ...item,
                source: item.source || "local",
                userId: item.userId || klevbyFeedGetCurrentUser()?.id || ""
              }))
          : [];
      }
    } catch (error) {
      console.warn("Klevby feed: не удалось получить локальные фото профиля", error);
    }

    return [];
  }

  function klevbyGetProfileFeedAvatarSafe(item = null) {
    const itemAvatar =
      item?.authorAvatar ||
      item?.authorAvatarUrl ||
      item?.avatar ||
      item?.avatarUrl ||
      "";

    if (itemAvatar) {
      return itemAvatar;
    }

    try {
      const localAvatar = localStorage.getItem(KLEVB_FEED_PROFILE_AVATAR_KEY) || "";
      const localProfile = klevbyFeedReadProfileData();
      const localName = String(localProfile.name || "").trim().toLowerCase();
      const itemName = String(item?.authorName || "").trim().toLowerCase();

      if (localAvatar && localName && itemName && localName === itemName) {
        return localAvatar;
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  function klevbyGetProfileFeedSearchText(item) {
    return klevbyFeedNormalizeText([
      item?.type,
      item?.authorName,
      item?.authorCity,
      item?.authorTelegram,
      item?.title,
      item?.caption,
      item?.source,
      "фото",
      "рыбалка",
      "профиль",
      "отчет",
      "отчёт",
      "лента",
      "соцсеть"
    ].join(" "));
  }

  function klevbyGetFilteredProfileFeedItems(options = {}) {
    const search = klevbyFeedNormalizeText(options.search);
    const selectedCity = klevbyFeedNormalizeText(options.selectedCity);
    const selectedType = klevbyFeedNormalizeText(options.selectedType);
    const telegramOnly = Boolean(options.telegramOnly);

    let items = klevbyGetProfileFeedItemsSafe();

    items = items.filter((item) => {
      if (!item || item.type !== "profile_photo" || !item.image) {
        return false;
      }

      if (search && !klevbyGetProfileFeedSearchText(item).includes(search)) {
        return false;
      }

      if (selectedCity && !klevbyFeedNormalizeText(item.authorCity).includes(selectedCity)) {
        return false;
      }

      if (selectedType) {
        const typeText = klevbyGetProfileFeedSearchText(item);

        if (!typeText.includes(selectedType)) {
          return false;
        }
      }

      if (telegramOnly && !klevbyFeedCleanTelegram(item.authorTelegram)) {
        return false;
      }

      return true;
    });

    return items;
  }

  async function klevbyLoadSupabaseFeedItems() {
    if (!window.klevbyFeedSupabase || typeof window.klevbyFeedSupabase.loadPosts !== "function") {
      return {
        ok: false,
        items: [],
        error: new Error("feed-supabase.js ещё не готов")
      };
    }

    try {
      const result = await window.klevbyFeedSupabase.loadPosts({
        limit: 40
      });

      if (!result || !result.ok) {
        return {
          ok: false,
          items: [],
          error: result?.error || new Error("Supabase-лента не загрузилась")
        };
      }

      return {
        ok: true,
        items: Array.isArray(result.items) ? result.items.filter(Boolean) : [],
        error: null
      };
    } catch (error) {
      console.warn("Klevby feed: Supabase-лента временно недоступна", error);

      return {
        ok: false,
        items: [],
        error
      };
    }
  }

  async function klevbyGetFeedItemsForRender() {
    const supabaseResult = await klevbyLoadSupabaseFeedItems();

    if (supabaseResult.ok && supabaseResult.items.length) {
      return {
        source: "supabase",
        items: supabaseResult.items
      };
    }

    const localItems = klevbyGetFilteredProfileFeedItems({});

    if (localItems.length) {
      return {
        source: "local",
        items: localItems
      };
    }

    return {
      source: supabaseResult.ok ? "supabase_empty" : "local_empty",
      items: []
    };
  }

  function klevbyFormatProfileFeedDate(value) {
    if (!value) return "";

    try {
      return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "";
    }
  }

  function klevbyOpenKlevbyProfileSafe() {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function klevbyCanManageFeedItem(item) {
    if (!item) return false;

    if (item.source === "local") {
      return true;
    }

    const user = klevbyFeedGetCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      klevbyFeedIsAdmin() ||
      (userId && item.userId && String(userId) === String(item.userId))
    );
  }

  function klevbyCanManageComment(comment) {
    if (!comment) return false;

    const user = klevbyFeedGetCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      klevbyFeedIsAdmin() ||
      (userId && comment.user_id && String(userId) === String(comment.user_id))
    );
  }

  function klevbyEnsureFeedStyles() {
    const oldStyle = document.getElementById("klevbyFeedStyles");

    if (oldStyle) {
      oldStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "klevbyFeedStyles";
    style.dataset.version = "20260507-compact-social-card-1";

    style.textContent = `
      .social-feed-grid {
        align-items: start;
      }

      .profile-feed-card {
        position: relative;
        overflow: hidden;
        width: min(100%, 620px);
        padding: 0 !important;
        border-radius: 28px !important;
        border: 1px solid rgba(244, 178, 74, 0.18) !important;
        background:
          radial-gradient(circle at 20% 0%, rgba(244, 178, 74, 0.10), transparent 38%),
          rgba(12, 21, 17, 0.94) !important;
        box-shadow:
          0 22px 62px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        cursor: pointer;
        transform: translateZ(0);
      }

      .profile-feed-card:active {
        transform: scale(0.992);
      }

      .profile-feed-image {
        width: 100% !important;
        min-height: 300px !important;
        height: clamp(300px, 38vw, 430px) !important;
        max-height: 430px !important;
        border-radius: 28px 28px 0 0 !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        box-shadow: inset 0 -80px 100px rgba(0,0,0,0.18);
      }

      .profile-feed-body {
        padding: 14px 16px 16px !important;
      }

      .profile-feed-avatar-img,
      .profile-feed-avatar-fallback {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        display: inline-flex;
        flex: 0 0 auto;
        border: 1px solid rgba(244,178,74,0.34);
        box-shadow: 0 12px 28px rgba(0,0,0,0.32);
      }

      .profile-feed-avatar-img {
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }

      .profile-feed-avatar-fallback {
        align-items: center;
        justify-content: center;
        background: rgba(244,178,74,0.16);
        color: #fff8ea;
        font-weight: 900;
      }

      .profile-feed-author {
        appearance: none;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 0;
        margin: 0 0 12px;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .profile-feed-author-text {
        min-width: 0;
        display: block;
      }

      .profile-feed-author-name {
        display: block;
        font-size: 15px;
        font-weight: 950;
        line-height: 1.12;
        color: #fff8ea;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-feed-author-action {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,248,234,0.56);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-feed-title {
        margin: 0 0 12px !important;
        color: #fff8ea !important;
        font-size: clamp(19px, 3.8vw, 26px) !important;
        line-height: 1.12 !important;
        font-weight: 950 !important;
        letter-spacing: -0.028em;
      }

      .profile-feed-title .trip-name {
        color: #ffb43e !important;
        text-shadow: 0 12px 32px rgba(255, 171, 48, 0.16);
      }

      .profile-feed-title .trip-destination {
        color: #fff8ea !important;
      }

      .profile-feed-tags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
        margin: 0 0 12px !important;
      }

      .profile-feed-tags .tag {
        min-height: 32px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid rgba(244,178,74,0.16);
        background: rgba(255,255,255,0.065);
        color: rgba(255,248,234,0.82);
        font-size: 12px;
        line-height: 1;
        font-weight: 900;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .profile-feed-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 0 !important;
      }

      .profile-feed-actions .small-btn {
        min-width: 0 !important;
        width: 100% !important;
        min-height: 46px !important;
        padding: 0 10px !important;
        border-radius: 17px !important;
        font-size: 14px !important;
        font-weight: 950 !important;
        box-shadow: none !important;
      }

      .profile-feed-open-btn {
        background: linear-gradient(180deg, #ffbd4a, #ff9f22) !important;
        color: #120c04 !important;
        border-color: rgba(255, 210, 117, 0.30) !important;
        box-shadow:
          0 14px 30px rgba(255, 165, 35, 0.16),
          inset 0 1px 0 rgba(255,255,255,0.24) !important;
      }

      .profile-feed-like-btn,
      .profile-feed-comment-btn,
      .profile-feed-profile-btn {
        background: rgba(255,255,255,0.075) !important;
        border-color: rgba(244,178,74,0.16) !important;
        color: rgba(255,248,234,0.90) !important;
      }

      .profile-feed-like-btn:active,
      .profile-feed-comment-btn:active,
      .profile-feed-profile-btn:active,
      .profile-feed-open-btn:active {
        transform: scale(0.98);
      }

      .home-empty-card {
        grid-column: 1 / -1;
        width: 100%;
        padding: 22px;
        border-radius: 26px;
        border: 1px solid rgba(244,178,74,0.14);
        background:
          radial-gradient(circle at 0% 0%, rgba(244,178,74,0.14), transparent 38%),
          rgba(13, 20, 17, 0.86);
        box-shadow: 0 12px 32px rgba(0,0,0,0.34);
      }

      .home-empty-icon {
        width: 54px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        border-radius: 20px;
        background: rgba(244,178,74,0.14);
        font-size: 26px;
      }

      .home-empty-card h3 {
        margin: 0 0 8px;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.15;
        font-weight: 900;
      }

      .home-empty-card p {
        margin: 0 0 16px;
        color: rgba(255,248,234,0.66);
        font-size: 14px;
        line-height: 1.5;
        font-weight: 600;
      }

      .klevby-feed-viewer.hidden,
      .klevby-feed-comment-modal.hidden {
        display: none !important;
      }

      .klevby-feed-viewer,
      .klevby-feed-comment-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding:
          max(18px, env(safe-area-inset-top))
          14px
          max(18px, env(safe-area-inset-bottom));
      }

      .klevby-feed-viewer-backdrop,
      .klevby-feed-comment-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .klevby-feed-viewer-sheet,
      .klevby-feed-comment-sheet {
        position: relative;
        z-index: 2;
        width: min(100%, 760px);
        max-height: 88dvh;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 28px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(244,178,74,0.12), transparent 42%),
          rgba(10, 14, 12, 0.96);
        box-shadow:
          0 28px 90px rgba(0,0,0,0.72),
          inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .klevby-feed-viewer-close,
      .klevby-feed-comment-close {
        appearance: none;
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 3;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 16px;
        background: rgba(0,0,0,0.45);
        color: #fff8ea;
        font-size: 28px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .klevby-feed-viewer-image {
        width: 100%;
        max-height: 66dvh;
        display: block;
        object-fit: contain;
        background: #050807;
      }

      .klevby-feed-viewer-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        color: #fff8ea;
      }

      .klevby-feed-viewer-info strong {
        display: block;
        font-size: 15px;
        font-weight: 900;
        line-height: 1.25;
      }

      .klevby-feed-viewer-info span {
        display: block;
        margin-top: 4px;
        color: rgba(255,248,234,0.55);
        font-size: 12px;
        font-weight: 700;
      }

      .klevby-feed-viewer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .klevby-feed-viewer-actions button {
        appearance: none;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 15px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        transition: 0.18s ease;
      }

      #klevbyFeedViewerLikeBtn,
      #klevbyFeedViewerCommentBtn {
        border: 1px solid rgba(244,178,74,0.20);
        background: rgba(244,178,74,0.18);
        color: #fff8ea !important;
      }

      #klevbyFeedViewerDeleteBtn {
        border: 1px solid rgba(228,88,88,0.24);
        background: rgba(228,88,88,0.92);
      }

      #klevbyFeedViewerDeleteBtn.hidden,
      #klevbyFeedViewerLikeBtn.hidden,
      #klevbyFeedViewerCommentBtn.hidden {
        display: none !important;
      }

      .klevby-feed-comment-sheet {
        width: min(100%, 620px);
        max-height: min(82dvh, 720px);
        padding: 22px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .klevby-feed-comment-sheet h3 {
        margin: 0 52px 8px 0;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.18;
        font-weight: 900;
      }

      .klevby-feed-comment-sheet p {
        margin: 0 0 14px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comments-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 260px;
        overflow-y: auto;
        margin: 0 0 14px;
        padding: 4px 2px 2px;
        -webkit-overflow-scrolling: touch;
      }

      .klevby-feed-comment-item {
        padding: 12px;
        border-radius: 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(244,178,74,0.11);
      }

      .klevby-feed-comment-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 7px;
      }

      .klevby-feed-comment-author {
        display: block;
        color: #fff8ea;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 900;
      }

      .klevby-feed-comment-date {
        display: block;
        margin-top: 2px;
        color: rgba(255,248,234,0.45);
        font-size: 11px;
        line-height: 1.2;
        font-weight: 700;
      }

      .klevby-feed-comment-delete {
        appearance: none;
        border: 1px solid rgba(228,88,88,0.22);
        background: rgba(228,88,88,0.12);
        color: #ffd2d2;
        border-radius: 999px;
        min-height: 28px;
        padding: 0 10px;
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        flex: 0 0 auto;
      }

      .klevby-feed-comment-text {
        margin: 0;
        color: rgba(255,248,234,0.82);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .klevby-feed-comments-empty {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.045);
        border: 1px dashed rgba(244,178,74,0.16);
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 700;
      }

      .klevby-feed-comment-textarea {
        width: 100%;
        min-height: 104px;
        resize: vertical;
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(244,178,74,0.16);
        outline: none;
        background: rgba(255,255,255,0.07);
        color: #fff8ea;
        font: inherit;
        font-size: 15px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comment-textarea::placeholder {
        color: rgba(255,248,234,0.42);
      }

      .klevby-feed-comment-actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }

      .klevby-feed-comment-actions .small-btn {
        flex: 1;
      }

      .klevby-feed-comment-message {
        min-height: 22px;
        margin-top: 12px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
      }

      .klevby-feed-comment-message.error-line {
        color: #ffd2d2;
        background: transparent;
        border: 0;
        padding: 0;
        box-shadow: none;
      }

      @media (max-width: 760px) {
        .profile-feed-card {
          width: 100%;
          border-radius: 26px !important;
        }

        .profile-feed-image {
          min-height: 280px !important;
          height: 34dvh !important;
          max-height: 340px !important;
          border-radius: 26px 26px 0 0 !important;
        }

        .profile-feed-body {
          padding: 13px 14px 15px !important;
        }

        .profile-feed-avatar-img,
        .profile-feed-avatar-fallback {
          width: 38px;
          height: 38px;
        }

        .profile-feed-author {
          margin-bottom: 10px;
        }

        .profile-feed-author-name {
          font-size: 14px;
        }

        .profile-feed-author-action {
          font-size: 12px;
        }

        .profile-feed-title {
          font-size: 20px !important;
          line-height: 1.12 !important;
          margin-bottom: 11px !important;
        }

        .profile-feed-tags {
          gap: 7px !important;
          margin-bottom: 11px !important;
        }

        .profile-feed-tags .tag {
          min-height: 31px;
          padding: 7px 10px;
          font-size: 12px;
        }

        .profile-feed-actions {
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 7px !important;
        }

        .profile-feed-actions .small-btn {
          min-height: 44px !important;
          padding: 0 8px !important;
          border-radius: 16px !important;
          font-size: 13px !important;
        }

        .klevby-feed-comment-modal {
          align-items: center !important;
          justify-content: center !important;
          padding:
            max(18px, env(safe-area-inset-top))
            12px
            max(18px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-feed-comment-sheet {
          border-radius: 24px;
          padding: 20px;
          max-height: 78dvh;
        }

        .klevby-feed-comments-list {
          max-height: 230px;
        }

        .klevby-feed-comment-textarea {
          min-height: 96px;
        }

        .klevby-feed-viewer {
          align-items: center;
          padding: 12px;
        }

        .klevby-feed-viewer-sheet {
          border-radius: 24px;
          max-height: 86dvh;
        }

        .klevby-feed-viewer-image {
          max-height: 58dvh;
        }

        .klevby-feed-viewer-info {
          align-items: flex-start;
          flex-direction: column;
        }

        .klevby-feed-viewer-actions {
          width: 100%;
          justify-content: stretch;
        }

        .klevby-feed-viewer-actions button {
          flex: 1;
        }
      }

      @media (max-width: 380px) {
        .profile-feed-image {
          min-height: 250px !important;
          height: 31dvh !important;
          max-height: 310px !important;
        }

        .profile-feed-title {
          font-size: 18px !important;
        }

        .profile-feed-actions .small-btn {
          min-height: 42px !important;
          font-size: 12px !important;
        }

        .klevby-feed-comments-list {
          max-height: 200px;
        }
      }
    `;

    document.body.appendChild(style);
  }

  function klevbyProfilePhotoCardHtml(item) {
    const safeId = klevbyFeedEscapeAttr(item?.id || "");
    const safeImage = klevbyFeedEscapeAttr(item?.image || item?.imageUrl || "");
    const authorName = item?.authorName || "Рыбак";
    const authorCity = item?.authorCity || "";
    const title = item?.title || item?.caption || "Фото с рыбалки";
    const likesCount = Number(item?.likesCount || 0);
    const commentsCount = Number(item?.commentsCount || 0);
    const date = klevbyFormatProfileFeedDate(item?.createdAt);
    const avatar = klevbyGetProfileFeedAvatarSafe(item);
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";
    const isSupabase = item?.source === "supabase";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${klevbyFeedEscapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${klevbyFeedEscapeHtml(authorInitial)}</span>`;

    const likeButton = isSupabase
      ? `<button class="small-btn gray profile-feed-like-btn" type="button" onclick="event.stopPropagation(); toggleFeedLike('${safeId}')">👍 ${likesCount}</button>`
      : "";

    const commentButton = isSupabase
      ? `<button class="small-btn gray profile-feed-comment-btn" type="button" onclick="event.stopPropagation(); openFeedCommentModal('${safeId}')">💬 ${commentsCount}</button>`
      : `<button class="small-btn gray profile-feed-profile-btn" type="button" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>`;

    return `
      <article class="card profile-feed-card" onclick="openProfilePhotoFeedItem('${safeId}')">
        <div class="card-img profile-feed-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.20)), url('${safeImage}')"></div>

        <div class="card-body profile-feed-body">
          <button
            class="profile-feed-author"
            type="button"
            onclick="event.stopPropagation(); openKlevbyProfileSafe()"
            aria-label="Открыть профиль автора"
          >
            ${avatarHtml}

            <span class="profile-feed-author-text">
              <span class="profile-feed-author-name">${klevbyFeedEscapeHtml(authorName)}</span>
              <span class="profile-feed-author-action">добавил фото с рыбалки</span>
            </span>
          </button>

          <div class="trip-title profile-feed-title">
            <span class="trip-name">${klevbyFeedEscapeHtml(authorName)}</span>
            <span> добавил </span>
            <span class="trip-destination">${klevbyFeedEscapeHtml(title)}</span>
          </div>

          <div class="tags profile-feed-tags">
            ${authorCity ? `<span class="tag">📍 ${klevbyFeedEscapeHtml(authorCity)}</span>` : ""}
            ${date ? `<span class="tag">🕒 ${klevbyFeedEscapeHtml(date)}</span>` : ""}
          </div>

          <div class="actions profile-feed-actions">
            <button class="small-btn green profile-feed-open-btn" type="button" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть</button>
            ${likeButton}
            ${commentButton}
          </div>
        </div>
      </article>
    `;
  }

  function klevbyProfileFeedEmptyHtml() {
    return `
      <div class="home-empty-card">
        <div class="home-empty-icon">📸</div>
        <h3>В ленте пока нет фото</h3>
        <p>Добавь первое фото в профиле — оно появится в общей ленте Klevby.</p>
        <div class="actions">
          <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
          <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
        </div>
      </div>
    `;
  }

  function klevbyProfileFeedLoadingHtml() {
    return `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
  }

  async function klevbyRenderProfileFeed() {
    const list = document.getElementById("profileFeedSection");
    if (!list) return;

    klevbyEnsureFeedStyles();

    const renderToken = ++klevbyFeedRenderToken;

    if (!klevbyFeedLastItems.length) {
      list.innerHTML = klevbyProfileFeedLoadingHtml();
    }

    const result = await klevbyGetFeedItemsForRender();

    if (renderToken !== klevbyFeedRenderToken) {
      return;
    }

    const items = Array.isArray(result.items) ? result.items : [];

    klevbyFeedLastItems = items;
    klevbyFeedItemsCache = {};

    items.forEach((item) => {
      if (item && item.id) {
        klevbyFeedItemsCache[String(item.id)] = item;
      }
    });

    if (!items.length) {
      list.innerHTML = klevbyProfileFeedEmptyHtml();
      return;
    }

    const cards = items
      .map((item) => {
        try {
          return klevbyProfilePhotoCardHtml(item);
        } catch (error) {
          console.error("Ошибка отрисовки фото ленты:", item, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    list.innerHTML = cards || klevbyProfileFeedEmptyHtml();
  }

  function klevbyRefreshFeedIfHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      klevbyRenderProfileFeed();
    }
  }

  function ensureKlevbyFeedPhotoViewer() {
    klevbyEnsureFeedStyles();

    let viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewer) return viewer;

    viewer = document.createElement("div");
    viewer.id = "klevbyFeedPhotoViewer";
    viewer.className = "klevby-feed-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");

    viewer.innerHTML = `
      <div class="klevby-feed-viewer-backdrop" onclick="closeFeedPhotoViewer()"></div>
      <div class="klevby-feed-viewer-sheet">
        <button class="klevby-feed-viewer-close" type="button" onclick="closeFeedPhotoViewer()" aria-label="Закрыть фото">×</button>
        <img id="klevbyFeedPhotoViewerImage" class="klevby-feed-viewer-image" alt="Фото из ленты">
        <div class="klevby-feed-viewer-info">
          <div>
            <strong id="klevbyFeedPhotoViewerTitle">Фото с рыбалки</strong>
            <span id="klevbyFeedPhotoViewerMeta">Лента Klevby</span>
          </div>

          <div class="klevby-feed-viewer-actions">
            <button id="klevbyFeedViewerLikeBtn" type="button">👍 0</button>
            <button id="klevbyFeedViewerCommentBtn" type="button">💬 Комментарии</button>
            <button id="klevbyFeedViewerDeleteBtn" type="button">Удалить</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);

    return viewer;
  }

  function klevbyOpenProfilePhotoFeedItem(photoId) {
    const cleanId = String(photoId || "");
    const cachedItem = klevbyFeedItemsCache[cleanId];

    if (cachedItem) {
      openKlevbyFeedPhotoViewer(cachedItem);
      return;
    }

    if (typeof window.openProfilePhotoViewer === "function") {
      window.openProfilePhotoViewer(cleanId);
      return;
    }

    klevbyOpenKlevbyProfileSafe();
  }

  function openKlevbyFeedPhotoViewer(item) {
    if (!item) return;

    const viewer = ensureKlevbyFeedPhotoViewer();
    const image = document.getElementById("klevbyFeedPhotoViewerImage");
    const title = document.getElementById("klevbyFeedPhotoViewerTitle");
    const meta = document.getElementById("klevbyFeedPhotoViewerMeta");
    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");
    const likeButton = document.getElementById("klevbyFeedViewerLikeBtn");
    const commentButton = document.getElementById("klevbyFeedViewerCommentBtn");

    const imageUrl = item.image || item.imageUrl || "";
    const titleText = item.title || item.caption || "Фото с рыбалки";
    const dateText = klevbyFormatProfileFeedDate(item.createdAt);
    const cityText = item.authorCity ? `📍 ${item.authorCity}` : "";
    const likesText = item.source === "supabase" ? `👍 ${Number(item.likesCount || 0)}` : "";
    const commentsText = item.source === "supabase" ? `💬 ${Number(item.commentsCount || 0)}` : "";

    if (image) image.src = imageUrl;
    if (title) title.textContent = titleText;

    if (meta) {
      meta.textContent = [
        cityText,
        dateText,
        likesText,
        commentsText
      ].filter(Boolean).join(" • ");
    }

    if (deleteButton) {
      const canDelete = klevbyCanManageFeedItem(item);

      deleteButton.classList.toggle("hidden", !canDelete);
      deleteButton.onclick = () => klevbyDeleteFeedItem(item);
    }

    if (likeButton) {
      const isSupabase = item.source === "supabase";

      likeButton.classList.toggle("hidden", !isSupabase);
      likeButton.textContent = `👍 ${Number(item.likesCount || 0)}`;
      likeButton.onclick = () => klevbyToggleFeedLikeFromViewer(item.id);
    }

    if (commentButton) {
      const isSupabase = item.source === "supabase";

      commentButton.classList.toggle("hidden", !isSupabase);
      commentButton.textContent = item.commentsCount ? `💬 ${Number(item.commentsCount || 0)}` : "💬 Комментарии";
      commentButton.onclick = () => klevbyOpenFeedCommentModal(item.id);
    }

    viewer.classList.remove("hidden");
    document.body.classList.add("post-modal-open");

    if (item.source === "supabase" && typeof window.klevbyRegisterFeedView === "function") {
      window.klevbyRegisterFeedView(item.id).then((added) => {
        if (added) {
          setTimeout(klevbyRenderProfileFeed, 550);
        }
      });
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function closeKlevbyFeedPhotoViewer() {
    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const image = document.getElementById("klevbyFeedPhotoViewerImage");

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    document.body.classList.remove("post-modal-open");
  }

  function ensureKlevbyFeedCommentModal() {
    klevbyEnsureFeedStyles();

    let modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "klevbyFeedCommentModal";
    modal.className = "klevby-feed-comment-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="klevby-feed-comment-backdrop" onclick="closeFeedCommentModal()"></div>
      <div class="klevby-feed-comment-sheet">
        <button class="klevby-feed-comment-close" type="button" onclick="closeFeedCommentModal()" aria-label="Закрыть комментарии">×</button>

        <h3>Комментарии</h3>
        <p id="klevbyFeedCommentSubtitle">Смотри отзывы рыбаков и добавляй свой.</p>

        <div id="klevbyFeedCommentsList" class="klevby-feed-comments-list">
          <div class="klevby-feed-comments-empty">Загружаем комментарии...</div>
        </div>

        <textarea
          id="klevbyFeedCommentText"
          class="klevby-feed-comment-textarea"
          maxlength="700"
          placeholder="Напиши свой комментарий..."
        ></textarea>

        <div class="klevby-feed-comment-actions">
          <button class="small-btn green" type="button" onclick="submitFeedComment()">Отправить</button>
          <button class="small-btn gray" type="button" onclick="closeFeedCommentModal()">Закрыть</button>
        </div>

        <div id="klevbyFeedCommentMessage" class="klevby-feed-comment-message"></div>
      </div>
    `;

    document.body.appendChild(modal);

    return modal;
  }

  function klevbyCommentHtml(comment) {
    const authorName = comment?.author_name || "Рыбак";
    const city = comment?.author_city || "";
    const text = comment?.text || "";
    const date = klevbyFormatProfileFeedDate(comment?.created_at);
    const canDelete = klevbyCanManageComment(comment);

    return `
      <div class="klevby-feed-comment-item">
        <div class="klevby-feed-comment-top">
          <div>
            <span class="klevby-feed-comment-author">
              ${klevbyFeedEscapeHtml(authorName)}
              ${city ? ` · ${klevbyFeedEscapeHtml(city)}` : ""}
            </span>
            ${date ? `<span class="klevby-feed-comment-date">${klevbyFeedEscapeHtml(date)}</span>` : ""}
          </div>

          ${
            canDelete
              ? `<button class="klevby-feed-comment-delete" type="button" onclick="deleteFeedComment('${klevbyFeedEscapeAttr(comment.id || "")}')">Удалить</button>`
              : ""
          }
        </div>

        <p class="klevby-feed-comment-text">${klevbyFeedEscapeHtml(text)}</p>
      </div>
    `;
  }

  async function klevbyRunLoadFeedComments(postId) {
    if (typeof window.klevbyLoadFeedComments === "function") {
      return window.klevbyLoadFeedComments(postId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.loadComments === "function"
    ) {
      return window.klevbyFeedSupabase.loadComments(postId);
    }

    return {
      ok: false,
      comments: [],
      error: new Error("Загрузка комментариев ещё не подключена.")
    };
  }

  async function klevbyLoadCommentsIntoModal(postId) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!list) return;

    list.innerHTML = `<div class="klevby-feed-comments-empty">Загружаем комментарии...</div>`;

    try {
      const result = await klevbyRunLoadFeedComments(postId);

      if (!result || !result.ok) {
        const errorMessage = result?.error?.message || "Не удалось загрузить комментарии.";

        list.innerHTML = `<div class="klevby-feed-comments-empty">${klevbyFeedEscapeHtml(errorMessage)}</div>`;
        return;
      }

      const comments = Array.isArray(result.comments) ? result.comments : [];

      if (!comments.length) {
        list.innerHTML = `<div class="klevby-feed-comments-empty">Комментариев пока нет. Напиши первый.</div>`;
        return;
      }

      list.innerHTML = comments.map(klevbyCommentHtml).join("");

      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });

      if (message) {
        message.textContent = "";
        message.classList.remove("error-line");
      }
    } catch (error) {
      console.warn("Klevby feed: комментарии не загрузились", error);
      list.innerHTML = `<div class="klevby-feed-comments-empty">${klevbyFeedEscapeHtml(error?.message || "Не удалось загрузить комментарии.")}</div>`;
    }
  }

  function klevbyOpenFeedCommentModal(postId) {
    const cleanId = String(postId || "");
    const item = klevbyFeedItemsCache[cleanId];

    if (!item) {
      alert("Фото не найдено в ленте. Обнови страницу и попробуй ещё раз.");
      return;
    }

    if (item.source !== "supabase") {
      alert("Это фото ещё локальное. Комментарии работают для фото из общей ленты.");
      return;
    }

    const modal = ensureKlevbyFeedCommentModal();
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const subtitle = document.getElementById("klevbyFeedCommentSubtitle");

    modal.dataset.postId = cleanId;

    if (textarea) textarea.value = "";
    if (message) {
      message.textContent = "";
      message.classList.remove("error-line");
    }

    if (subtitle) {
      subtitle.textContent = `${item.authorName || "Рыбак"} добавил фото. Ниже комментарии и поле для твоего отзыва.`;
    }

    modal.classList.remove("hidden");
    document.body.classList.add("post-modal-open");

    klevbyLoadCommentsIntoModal(cleanId);

    setTimeout(() => {
      if (textarea) textarea.focus({ preventScroll: true });
    }, 220);
  }

  function closeKlevbyFeedCommentModal() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      modal.classList.add("hidden");
      modal.dataset.postId = "";
    }

    document.body.classList.remove("post-modal-open");
  }

  async function klevbyRunAddFeedComment(postId, text) {
    if (typeof window.klevbyAddFeedComment === "function") {
      return window.klevbyAddFeedComment(postId, text);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.addComment === "function"
    ) {
      return window.klevbyFeedSupabase.addComment(postId, text);
    }

    throw new Error("Комментарии ещё не подключены в feed-supabase.js.");
  }

  async function klevbySubmitFeedComment() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!modal || !textarea) return;

    const postId = String(modal.dataset.postId || "");
    const text = String(textarea.value || "").trim();

    if (!postId) {
      if (message) {
        message.textContent = "Фото не найдено. Закрой окно и попробуй ещё раз.";
        message.classList.add("error-line");
      }
      return;
    }

    if (!text) {
      if (message) {
        message.textContent = "Напиши комментарий перед отправкой.";
        message.classList.add("error-line");
      }
      textarea.focus();
      return;
    }

    if (text.length > 700) {
      if (message) {
        message.textContent = "Комментарий слишком длинный. Сделай короче.";
        message.classList.add("error-line");
      }
      textarea.focus();
      return;
    }

    if (message) {
      message.textContent = "Отправляем комментарий...";
      message.classList.remove("error-line");
    }

    try {
      await klevbyRunAddFeedComment(postId, text);

      textarea.value = "";

      if (message) {
        message.textContent = "✅ Комментарий отправлен.";
        message.classList.remove("error-line");
      }

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      await klevbyLoadCommentsIntoModal(postId);
      await klevbyRenderProfileFeed();
    } catch (error) {
      console.warn("Klevby feed: комментарий не отправился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось отправить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  async function klevbyDeleteFeedCommentFromModal(commentId) {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const postId = String(modal?.dataset?.postId || "");

    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) return;

    if (!confirm("Удалить комментарий?")) {
      return;
    }

    try {
      if (typeof window.klevbyDeleteFeedComment === "function") {
        await window.klevbyDeleteFeedComment(cleanCommentId);
      } else if (
        window.klevbyFeedSupabase &&
        typeof window.klevbyFeedSupabase.deleteComment === "function"
      ) {
        await window.klevbyFeedSupabase.deleteComment(cleanCommentId);
      } else {
        throw new Error("Удаление комментариев ещё не подключено.");
      }

      if (message) {
        message.textContent = "Комментарий удалён.";
        message.classList.remove("error-line");
      }

      if (postId) {
        await klevbyLoadCommentsIntoModal(postId);
      }

      await klevbyRenderProfileFeed();
    } catch (error) {
      console.warn("Klevby feed: комментарий не удалился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось удалить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  async function klevbyDeleteFeedItem(item) {
    if (!item || !item.id) return;

    if (!confirm("Удалить фото из ленты? Это действие нельзя отменить.")) {
      return;
    }

    try {
      if (item.source === "supabase") {
        if (typeof window.klevbyDeleteFeedPostFromSupabase !== "function") {
          alert("Модуль удаления Supabase ещё не готов.");
          return;
        }

        await window.klevbyDeleteFeedPostFromSupabase(item.id, item.imagePath || "");
      } else if (typeof window.removeProfilePhoto === "function") {
        window.removeProfilePhoto(item.id);
      }

      closeKlevbyFeedPhotoViewer();
      await klevbyRenderProfileFeed();

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch (error) {
      console.error("Klevby feed: не удалось удалить фото", error);
      alert(error?.message || "Не получилось удалить фото.");
    }
  }

  async function klevbyToggleFeedLikeFromCard(postId) {
    const cleanId = String(postId || "");

    if (!cleanId) return;

    if (typeof window.klevbyToggleFeedLike !== "function") {
      alert("Лайки ещё не подключены.");
      return;
    }

    try {
      await window.klevbyToggleFeedLike(cleanId);
      await klevbyRenderProfileFeed();

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (error) {
      console.warn("Klevby feed: лайк не сработал", error);
      alert(error?.message || "Не получилось поставить лайк.");
    }
  }

  async function klevbyToggleFeedLikeFromViewer(postId) {
    await klevbyToggleFeedLikeFromCard(postId);

    const cleanId = String(postId || "");
    const updatedItem = klevbyFeedItemsCache[cleanId];

    if (updatedItem) {
      openKlevbyFeedPhotoViewer(updatedItem);
    }
  }

  function klevbyTryStartRealtimeSubscription() {
    if (klevbyFeedRealtimeStarted) return;

    const api = window.klevbyFeedSupabase;

    if (!api) return;

    const refresh = () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 120);

      const modal = document.getElementById("klevbyFeedCommentModal");
      const postId = String(modal?.dataset?.postId || "");

      if (modal && !modal.classList.contains("hidden") && postId) {
        setTimeout(() => {
          klevbyLoadCommentsIntoModal(postId);
        }, 180);
      }
    };

    try {
      if (typeof api.subscribeToFeedChanges === "function") {
        api.subscribeToFeedChanges(refresh);
        klevbyFeedRealtimeStarted = true;
        return;
      }

      if (typeof api.subscribeToChanges === "function") {
        api.subscribeToChanges(refresh);
        klevbyFeedRealtimeStarted = true;
        return;
      }

      if (typeof api.subscribe === "function") {
        api.subscribe(refresh);
        klevbyFeedRealtimeStarted = true;
      }
    } catch (error) {
      console.warn("Klevby feed: realtime пока не подключился", error);
    }
  }

  function klevbyStartFeedAutoRefresh() {
    if (klevbyFeedAutoRefreshTimer) return;

    klevbyFeedAutoRefreshTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;

      klevbyRefreshFeedIfHomeVisible();

      const modal = document.getElementById("klevbyFeedCommentModal");
      const postId = String(modal?.dataset?.postId || "");

      if (modal && !modal.classList.contains("hidden") && postId) {
        klevbyLoadCommentsIntoModal(postId);
      }
    }, 6000);
  }

  function klevbyBindFeedRefreshHooks() {
    if (window.__klevbyFeedRefreshBound) return;
    window.__klevbyFeedRefreshBound = true;

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === KLEVB_FEED_PROFILE_PHOTOS_KEY ||
        key === KLEVB_FEED_PROFILE_AVATAR_KEY ||
        key === KLEVB_FEED_PROFILE_SETTINGS_KEY ||
        key === KLEVB_FEED_PROFILE_NAME_KEY
      ) {
        setTimeout(klevbyRefreshFeedIfHomeVisible, 80);
      }
    });

    window.addEventListener("pageshow", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 120);
    });

    window.addEventListener("focus", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 160);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        setTimeout(klevbyRefreshFeedIfHomeVisible, 160);
      }
    });

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 180);
    });

    window.addEventListener("klevby-feed-updated", (event) => {
      setTimeout(klevbyRenderProfileFeed, 220);

      const modal = document.getElementById("klevbyFeedCommentModal");
      const activePostId = String(modal?.dataset?.postId || "");
      const changedPostId = String(event?.detail?.postId || "");

      if (
        modal &&
        !modal.classList.contains("hidden") &&
        activePostId &&
        (!changedPostId || changedPostId === activePostId)
      ) {
        setTimeout(() => {
          klevbyLoadCommentsIntoModal(activePostId);
        }, 260);
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(klevbyRefreshFeedIfHomeVisible, 180);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeKlevbyFeedPhotoViewer();
        closeKlevbyFeedCommentModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    klevbyEnsureFeedStyles();
    klevbyBindFeedRefreshHooks();
    klevbyStartFeedAutoRefresh();

    setTimeout(klevbyRenderProfileFeed, 350);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 900);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 1600);
    setTimeout(klevbyTryStartRealtimeSubscription, 1200);
    setTimeout(klevbyTryStartRealtimeSubscription, 2600);
  });

  window.getProfileFeedItemsSafe = klevbyGetProfileFeedItemsSafe;
  window.getFilteredProfileFeedItems = klevbyGetFilteredProfileFeedItems;
  window.openKlevbyProfileSafe = klevbyOpenKlevbyProfileSafe;
  window.openProfilePhotoFeedItem = klevbyOpenProfilePhotoFeedItem;
  window.renderProfileFeed = klevbyRenderProfileFeed;
  window.profilePhotoCardHtml = klevbyProfilePhotoCardHtml;
  window.toggleFeedLike = klevbyToggleFeedLikeFromCard;
  window.closeFeedPhotoViewer = closeKlevbyFeedPhotoViewer;
  window.openFeedCommentModal = klevbyOpenFeedCommentModal;
  window.closeFeedCommentModal = closeKlevbyFeedCommentModal;
  window.submitFeedComment = klevbySubmitFeedComment;
  window.deleteFeedComment = klevbyDeleteFeedCommentFromModal;
})();
