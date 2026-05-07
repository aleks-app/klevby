(function () {
  const KLEVB_FEED_PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";

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

  function klevbyGetProfileFeedItemsSafe() {
    try {
      if (typeof window.getProfileFeedItems === "function") {
        const items = window.getProfileFeedItems();
        return Array.isArray(items) ? items.filter(Boolean) : [];
      }
    } catch (error) {
      console.warn("Klevby feed: не удалось получить фото профиля", error);
    }

    return [];
  }

  function klevbyGetProfileFeedAvatarSafe() {
    try {
      return localStorage.getItem(KLEVB_FEED_PROFILE_AVATAR_KEY) || "";
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

  function klevbyOpenProfilePhotoFeedItem(photoId) {
    const cleanId = String(photoId || "");

    if (typeof window.openProfilePhotoViewer === "function") {
      window.openProfilePhotoViewer(cleanId);
      return;
    }

    klevbyOpenKlevbyProfileSafe();
  }

  function klevbyProfilePhotoCardHtml(item) {
    const safeId = klevbyFeedEscapeAttr(item?.id || "");
    const safeImage = klevbyFeedEscapeAttr(item?.image || "");
    const authorName = item?.authorName || "Рыбак";
    const authorCity = item?.authorCity || "";
    const title = item?.title || "Фото с рыбалки";
    const sizeKb = Number(item?.savedSizeKb || 0);
    const date = klevbyFormatProfileFeedDate(item?.createdAt);
    const avatar = klevbyGetProfileFeedAvatarSafe();
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${klevbyFeedEscapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${klevbyFeedEscapeHtml(authorInitial)}</span>`;

    return `
      <article class="card profile-feed-card" onclick="openProfilePhotoFeedItem('${safeId}')">
        <div class="card-img profile-feed-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42)), url('${safeImage}')"></div>

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

          <p class="trip-description profile-feed-description">
            Новое фото в профиле рыбака. Нажми на карточку, чтобы открыть фото на весь экран.
          </p>

          <div class="tags profile-feed-tags">
            <span class="tag">📸 фото</span>
            <span class="tag">🎣 лента</span>
            ${authorCity ? `<span class="tag">📍 ${klevbyFeedEscapeHtml(authorCity)}</span>` : ""}
            ${sizeKb ? `<span class="tag">${klevbyFeedEscapeHtml(String(sizeKb))} КБ</span>` : ""}
            ${date ? `<span class="tag">🕒 ${klevbyFeedEscapeHtml(date)}</span>` : ""}
          </div>

          <div class="actions profile-feed-actions">
            <button class="small-btn green" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть фото</button>
            <button class="small-btn gray" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>
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
        <p>Добавь первое фото в профиле — оно появится здесь как пост в ленте.</p>
        <div class="actions">
          <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
          <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
        </div>
      </div>
    `;
  }

  function klevbyRenderProfileFeed() {
    const list = document.getElementById("profileFeedSection");
    if (!list) return;

    const items = klevbyGetFilteredProfileFeedItems({});

    if (!items.length) {
      list.innerHTML = klevbyProfileFeedEmptyHtml();
      return;
    }

    const cards = items
      .map((item) => {
        try {
          return klevbyProfilePhotoCardHtml(item);
        } catch (error) {
          console.error("Ошибка отрисовки фото профиля:", item, error);
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

  function klevbyBindFeedRefreshHooks() {
    if (window.__klevbyFeedRefreshBound) return;
    window.__klevbyFeedRefreshBound = true;

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === KLEVB_FEED_PROFILE_PHOTOS_KEY ||
        key === KLEVB_FEED_PROFILE_AVATAR_KEY ||
        key === "klevby_profile_settings" ||
        key === "klevby_profile_name"
      ) {
        setTimeout(klevbyRefreshFeedIfHomeVisible, 80);
      }
    });

    window.addEventListener("pageshow", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 120);
    });

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 120);
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(klevbyRefreshFeedIfHomeVisible, 180);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    klevbyBindFeedRefreshHooks();

    setTimeout(klevbyRenderProfileFeed, 300);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 800);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 1400);
  });

  window.getProfileFeedItemsSafe = klevbyGetProfileFeedItemsSafe;
  window.getFilteredProfileFeedItems = klevbyGetFilteredProfileFeedItems;
  window.openKlevbyProfileSafe = klevbyOpenKlevbyProfileSafe;
  window.openProfilePhotoFeedItem = klevbyOpenProfilePhotoFeedItem;
  window.renderProfileFeed = klevbyRenderProfileFeed;
  window.profilePhotoCardHtml = klevbyProfilePhotoCardHtml;
})();
