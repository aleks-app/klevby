(function () {
  const VIEWER_OVERLAY_CLASS = "public-profile-viewer-overlay";
  const VIEWER_HIDDEN_CLASS = "hidden";
  let viewerElements = null;

  function ensureViewer() {
    if (viewerElements) return viewerElements;

    const overlay = document.createElement("div");
    overlay.className = `${VIEWER_OVERLAY_CLASS} ${VIEWER_HIDDEN_CLASS}`;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Просмотр фото");

    const panel = document.createElement("div");
    panel.className = "public-profile-viewer-panel";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "public-profile-viewer-close";
    closeButton.setAttribute("aria-label", "Закрыть просмотр фото");
    closeButton.textContent = "← Назад";

    const img = document.createElement("img");
    img.className = "public-profile-viewer-image";
    img.alt = "Фото автора";
    img.loading = "eager";
    img.decoding = "async";

    closeButton.addEventListener("click", hideViewer);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) hideViewer();
    });
    panel.addEventListener("click", (event) => event.stopPropagation());

    panel.appendChild(closeButton);
    panel.appendChild(img);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    viewerElements = { overlay, img };
    return viewerElements;
  }

  function showViewer(url) {
    if (!url) return;

    const { overlay, img } = ensureViewer();
    img.src = url;
    overlay.classList.remove(VIEWER_HIDDEN_CLASS);
    document.body.classList.add("public-profile-viewer-open");
  }

  function hideViewer() {
    if (!viewerElements) return;
    viewerElements.overlay.classList.add(VIEWER_HIDDEN_CLASS);
    viewerElements.img.removeAttribute("src");
    document.body.classList.remove("public-profile-viewer-open");
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !viewerElements) return;
    if (viewerElements.overlay.classList.contains(VIEWER_HIDDEN_CLASS)) return;
    hideViewer();
  });

  function renderGallery(container, photos) {
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(photos) || photos.length === 0) {
      container.innerHTML = '<div class="public-profile-empty">У автора пока нет фото в ленте.</div>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "public-profile-gallery-grid";

    photos.forEach((url) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "public-profile-photo";

      const img = document.createElement("img");
      img.src = url;
      img.alt = "Фото автора";
      img.loading = "lazy";

      button.appendChild(img);
      button.addEventListener("click", () => {
        showViewer(url);
      });

      grid.appendChild(button);
    });

    container.appendChild(grid);
  }

  window.KlevbyPublicProfileGallery = {
    renderGallery
  };
})();
