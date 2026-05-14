(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderGallery(container, photos = []) {
    if (!container) return;

    const safePhotos = Array.isArray(photos) ? photos : [];

    if (!safePhotos.length) {
      container.innerHTML = '<div class="public-profile-empty">У автора пока нет фото в ленте.</div>';
      return;
    }

    container.innerHTML = safePhotos.map((photo) => {
      const imageUrl = escapeHtml(photo?.image_url || "");
      const caption = escapeHtml(photo?.caption || "Фото");
      const fullUrl = escapeHtml(photo?.image_url || "");

      return `
        <a class="public-profile-gallery-item" href="${fullUrl}" target="_blank" rel="noopener noreferrer" aria-label="Открыть фото">
          <img src="${imageUrl}" alt="${caption}" loading="lazy" decoding="async">
        </a>
      `;
    }).join("");
  }

  window.KlevbyPublicProfileGallery = {
    renderGallery
  };
})();
