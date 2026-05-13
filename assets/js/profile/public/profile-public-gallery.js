(function () {
  const MODAL_ID = "klevbyPublicProfileGalleryModal";

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "klevby-public-gallery hidden";
    modal.innerHTML = `
      <div class="klevby-public-gallery-backdrop" data-close="1"></div>
      <div class="klevby-public-gallery-card" role="dialog" aria-modal="true">
        <button type="button" class="klevby-public-gallery-close" data-close="1">✕</button>
        <img class="klevby-public-gallery-image" alt="Фото автора" />
        <div class="klevby-public-gallery-caption"></div>
      </div>`;
    modal.addEventListener("click", (event) => {
      const close = event.target?.getAttribute?.("data-close");
      if (close === "1") hide();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function show(photo) {
    const modal = ensureModal();
    const img = modal.querySelector(".klevby-public-gallery-image");
    const caption = modal.querySelector(".klevby-public-gallery-caption");
    img.src = String(photo?.imageUrl || photo?.image || "");
    caption.textContent = String(photo?.caption || "");
    modal.classList.remove("hidden");
  }

  function hide() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.add("hidden");
  }

  window.KlevbyPublicProfileGallery = { show, hide };
})();
