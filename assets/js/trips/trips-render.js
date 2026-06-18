(function () {
  "use strict";

  function getDom() {
    return {
      count: document.querySelector("#tripsSection .trips-fullscreen-list-count"),
      title: document.querySelector("#tripsSection .trips-fullscreen-list-title"),
      postsRoot: document.getElementById("tripsFullscreenPostsSection"),
      activeShelf: document.getElementById("tripsFullscreenActiveShelf"),
      archiveShelf: document.getElementById("tripsFullscreenArchiveShelf")
    };
  }

  function renderShell(state) {
    const dom = getDom();
    if (dom.count) dom.count.textContent = String(state.counts.activeCount);
    if (dom.title) dom.title.textContent = state.selectedShelf === "archive" ? "Архив выездов" : "Актуальные выезды";
    if (dom.postsRoot) dom.postsRoot.dataset.selectedShelf = state.selectedShelf;
    if (dom.activeShelf) dom.activeShelf.hidden = state.selectedShelf !== "active";
    if (dom.archiveShelf) dom.archiveShelf.hidden = state.selectedShelf !== "archive";
  }

  window.KlevbyTripsRender = {
    getDom,
    renderShell
  };
}());
