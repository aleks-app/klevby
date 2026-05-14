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
        <div class="public-profile-header">
          <button type="button" class="public-profile-back" data-klevby-public-back>← Назад</button>
          <h2 class="public-profile-title">Публичный профиль</h2>
        </div>
        <div class="public-profile-body">
          <div class="public-profile-user">
            <div class="public-profile-avatar" data-klevby-public-avatar>🎣</div>
            <div>
              <div class="public-profile-name" data-klevby-public-name>Рыбак</div>
              <div class="public-profile-city" data-klevby-public-city></div>
            </div>
          </div>
          <div class="public-profile-gallery" data-klevby-public-gallery></div>
        </div>
      </div>`;

    document.body.appendChild(root);
    return root;
  }

  function renderProfile(profile) {
    const root = ensureOverlay();
    const nameNode = root.querySelector("[data-klevby-public-name]");
    const cityNode = root.querySelector("[data-klevby-public-city]");
    const avatarNode = root.querySelector("[data-klevby-public-avatar]");

    if (nameNode) nameNode.textContent = profile?.name || "Рыбак";
    if (cityNode) cityNode.textContent = profile?.city ? `📍 ${profile.city}` : "";

    if (avatarNode) {
      const avatarUrl = profile?.avatar_url || "";
      avatarNode.innerHTML = avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" />` : "🎣";
    }
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
