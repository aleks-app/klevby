(function () {
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
        try {
          window.open(url, "_blank", "noopener");
        } catch (_) {}
      });

      grid.appendChild(button);
    });

    container.appendChild(grid);
  }

  window.KlevbyPublicProfileGallery = {
    renderGallery
  };
})();
