(function () {
  const ROOT_ID = "klevbyPublicProfileOverlay";

  function ensureOverlay() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "public-profile-overlay hidden";
    root.innerHTML = `
      <div class="public-profile-screen" role="dialog" aria-modal="true" aria-label="Публичный профиль">
        <div class="public-profile-hero">
          <div class="public-profile-header">
            <button type="button" class="public-profile-back" data-klevby-public-back>← Назад</button>
            <h2 class="public-profile-title">Публичный профиль</h2>
          </div>
          <div class="public-profile-body">
            <div class="public-profile-user">
              <div class="public-profile-avatar" data-klevby-public-avatar>🎣</div>
              <div>
                <div class="public-profile-name" data-klevby-public-name>Рыбак</div>
                <div class="public-profile-subtitle">🎣 Рыбак Klevgo</div>
              </div>
            </div>
            <div class="public-profile-stats" data-klevby-public-stats></div>
            <div class="public-profile-tabs" aria-label="Разделы профиля">
              <button type="button" class="public-profile-tab is-active">Фото</button>
              <button type="button" class="public-profile-tab" data-klevby-public-placeholder-tab data-label="Отчёты">Отчёты</button>
              <button type="button" class="public-profile-tab" data-klevby-public-placeholder-tab data-label="Выезды">Выезды</button>
              <button type="button" class="public-profile-tab" data-klevby-public-placeholder-tab data-label="О себе">О себе</button>
            </div>
            <div class="public-profile-tab-note" data-klevby-public-tab-note hidden></div>
          </div>
        </div>

        <div class="public-profile-body public-profile-content">
          <section class="public-profile-section">
            <h3 class="public-profile-section-title">Фото и отчёты</h3>
            <div class="public-profile-gallery" data-klevby-public-gallery></div>
          </section>

          <section class="public-profile-section">
            <h3 class="public-profile-section-title">О себе</h3>
            <div class="public-profile-placeholder">Информация об авторе появится позже.</div>
          </section>
        </div>
      </div>`;

    document.body.appendChild(root);
    bindPlaceholderTabs(root);
    return root;
  }


  let tabNoteTimeout = null;

  function bindPlaceholderTabs(root) {
    const tabs = root.querySelectorAll("[data-klevby-public-placeholder-tab]");
    const note = root.querySelector("[data-klevby-public-tab-note]");
    if (!tabs.length || !note) return;

    const showNote = () => {
      note.textContent = "Раздел скоро появится.";
      note.hidden = false;
      note.classList.remove("is-visible");
      requestAnimationFrame(() => note.classList.add("is-visible"));

      if (tabNoteTimeout) clearTimeout(tabNoteTimeout);
      tabNoteTimeout = setTimeout(() => {
        note.hidden = true;
        note.classList.remove("is-visible");
      }, 3000);
    };

    tabs.forEach((tab) => {
      tab.onclick = (event) => {
        event.preventDefault();
        showNote();
      };
    });
  }

  function renderStats(root, photoCount) {
    const statsNode = root.querySelector("[data-klevby-public-stats]");
    if (!statsNode) return;

    statsNode.innerHTML = `
      <div class="public-profile-stat"><div class="public-profile-stat-value">${photoCount}</div><div class="public-profile-stat-label">Фото</div></div>
      <div class="public-profile-stat"><div class="public-profile-stat-value">Скоро</div><div class="public-profile-stat-label">Отчёты</div></div>
      <div class="public-profile-stat"><div class="public-profile-stat-value">Скоро</div><div class="public-profile-stat-label">Выезды</div></div>
      <div class="public-profile-stat"><div class="public-profile-stat-value">Скоро</div><div class="public-profile-stat-label">Напарники</div></div>`;
  }

  function renderProfile(profile, photos) {
    const root = ensureOverlay();
    const nameNode = root.querySelector("[data-klevby-public-name]");
    const avatarNode = root.querySelector("[data-klevby-public-avatar]");

    if (nameNode) nameNode.textContent = profile?.name || "Рыбак";

    if (avatarNode) {
      const avatarUrl = profile?.avatar_url || "";
      avatarNode.innerHTML = avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" />` : "🎣";
    }

    const photoCount = Array.isArray(photos) ? photos.length : 0;
    renderStats(root, photoCount);
  }

  function show() {
    const root = ensureOverlay();
    root.classList.remove("hidden");
  }

  function hide() {
    const root = ensureOverlay();
    root.classList.add("hidden");
  }

  function getGalleryContainer() {
    return ensureOverlay().querySelector("[data-klevby-public-gallery]");
  }

  function bindClose(onClose) {
    const back = ensureOverlay().querySelector("[data-klevby-public-back]");
    if (!back) return;

    back.onclick = () => {
      if (typeof onClose === "function") onClose();
    };
  }

  window.KlevbyPublicProfileRender = {
    ensureOverlay,
    renderProfile,
    getGalleryContainer,
    show,
    hide,
    bindClose
  };
})();
