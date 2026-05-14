(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureRoot() {
    let root = document.getElementById("klevbyPublicProfileRoot");

    if (root) return root;

    root = document.createElement("section");
    root.id = "klevbyPublicProfileRoot";
    root.className = "public-profile-screen hidden";
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `
      <div class="public-profile-backdrop" data-public-profile-close="true"></div>
      <div class="public-profile-sheet" role="dialog" aria-modal="true" aria-label="Публичный профиль">
        <div class="public-profile-header">
          <button class="small-btn gray" type="button" data-public-profile-close="true">← Назад</button>
          <h2>Публичный профиль</h2>
        </div>
        <div id="klevbyPublicProfileContent" class="public-profile-content"></div>
      </div>
    `;

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('[data-public-profile-close="true"]')) {
        if (typeof window.closeKlevbyPublicProfile === "function") {
          window.closeKlevbyPublicProfile();
        }
      }
    });

    document.body.appendChild(root);
    return root;
  }

  function setOpen(isOpen) {
    const root = ensureRoot();
    root.classList.toggle("hidden", !isOpen);
    document.body.classList.toggle("public-profile-open", Boolean(isOpen));
  }

  function renderLoading() {
    const root = ensureRoot();
    const content = root.querySelector("#klevbyPublicProfileContent");
    if (!content) return;
    content.innerHTML = '<div class="public-profile-loading">Загрузка публичного профиля…</div>';
  }

  function renderError(message = "") {
    const root = ensureRoot();
    const content = root.querySelector("#klevbyPublicProfileContent");
    if (!content) return;

    content.innerHTML = `<div class="public-profile-error">${escapeHtml(message || "Не удалось загрузить публичный профиль")}</div>`;
  }

  function renderProfile(profile = {}, photos = [], fallbackData = {}) {
    const root = ensureRoot();
    const content = root.querySelector("#klevbyPublicProfileContent");
    if (!content) return;

    const displayName = escapeHtml(
      profile.display_name ||
      profile.nickname ||
      profile.username ||
      fallbackData.authorName ||
      "Рыбак"
    );
    const city = escapeHtml(profile.city || fallbackData.authorCity || "");
    const avatarUrl = escapeHtml(profile.avatar_url || fallbackData.avatarUrl || "");
    const initial = escapeHtml(String(displayName).charAt(0).toUpperCase() || "Р");

    content.innerHTML = `
      <div class="public-profile-card">
        <div class="public-profile-avatar-wrap">
          ${avatarUrl
            ? `<img class="public-profile-avatar" src="${avatarUrl}" alt="${displayName}" loading="lazy">`
            : `<div class="public-profile-avatar-fallback">${initial}</div>`}
        </div>
        <div class="public-profile-meta">
          <h3>${displayName}</h3>
          ${city ? `<p>📍 ${city}</p>` : ""}
        </div>
      </div>
      <div id="klevbyPublicProfileGallery" class="public-profile-gallery"></div>
    `;

    const galleryNode = content.querySelector("#klevbyPublicProfileGallery");
    const gallery = window.KlevbyPublicProfileGallery || {};

    if (galleryNode && typeof gallery.renderGallery === "function") {
      gallery.renderGallery(galleryNode, photos);
    }
  }

  window.KlevbyPublicProfileRender = {
    ensureRoot,
    setOpen,
    renderLoading,
    renderError,
    renderProfile
  };
})();
