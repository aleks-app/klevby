(function () {
  const OVERLAY_ID = "klevbyPublicProfileOverlay";

  function esc(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function ensureRoot() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;
    root = document.createElement("section");
    root.id = OVERLAY_ID;
    root.className = "klevby-public-profile hidden";
    document.body.appendChild(root);
    return root;
  }

  function render({ profile, posts, loading, error }) {
    const root = ensureRoot();
    const safePosts = Array.isArray(posts) ? posts : [];

    if (loading) {
      root.innerHTML = `<div class="klevby-public-profile-panel"><div class="klevby-public-loader">Загружаем профиль…</div></div>`;
      return;
    }

    if (error) {
      root.innerHTML = `<div class="klevby-public-profile-panel"><button class="klevby-public-back" type="button" onclick="window.closeKlevbyPublicProfile?.()">← Назад</button><div class="klevby-public-empty">Не удалось открыть профиль.</div></div>`;
      return;
    }

    const gridHtml = safePosts.length
      ? safePosts.map((p, i) => `<button class="klevby-public-photo" type="button" data-photo-index="${i}"><img src="${esc(p.imageUrl || p.image)}" alt="" /></button>`).join("")
      : `<div class="klevby-public-empty">У автора пока нет фото в ленте.</div>`;

    const feedHtml = safePosts.length
      ? safePosts.map((p) => `<article class="klevby-public-post"><img src="${esc(p.imageUrl || p.image)}" alt="" /><p>${esc(p.caption || "Фото с рыбалки")}</p></article>`).join("")
      : `<div class="klevby-public-empty">Публикаций пока нет.</div>`;

    root.innerHTML = `
      <div class="klevby-public-profile-panel">
        <button class="klevby-public-back" type="button" onclick="window.closeKlevbyPublicProfile?.()">← Назад</button>
        <div class="klevby-public-header">
          <div class="klevby-public-cover"></div>
          <div class="klevby-public-avatar-wrap">
            ${profile?.avatarUrl ? `<img class="klevby-public-avatar" src="${esc(profile.avatarUrl)}" alt="" />` : `<div class="klevby-public-avatar klevby-public-avatar-fallback">🎣</div>`}
          </div>
          <h2>${esc(profile?.name || "Рыбак")}</h2>
          <p>${esc(profile?.city || "")}</p>
          <div class="klevby-public-stats"><span>Фото: ${safePosts.length}</span><span>Публикации: ${safePosts.length}</span></div>
        </div>
        <div class="klevby-public-sections">
          <h3>Фото</h3>
          <div class="klevby-public-grid">${gridHtml}</div>
          <h3>Лента</h3>
          <div class="klevby-public-feed">${feedHtml}</div>
          <h3>О себе</h3>
          <div class="klevby-public-about">${esc(profile?.about || "Автор пока не добавил описание.")}</div>
        </div>
      </div>`;

    root.querySelectorAll("[data-photo-index]").forEach((node) => {
      node.addEventListener("click", () => {
        const idx = Number(node.getAttribute("data-photo-index") || -1);
        const photo = safePosts[idx];
        if (photo && window.KlevbyPublicProfileGallery?.show) window.KlevbyPublicProfileGallery.show(photo);
      });
    });
  }

  function show() { ensureRoot().classList.remove("hidden"); document.body.classList.add("klevby-public-profile-open"); }
  function hide() { const r=ensureRoot(); r.classList.add("hidden"); document.body.classList.remove("klevby-public-profile-open"); }

  window.KlevbyPublicProfileRender = { render, show, hide };
})();
