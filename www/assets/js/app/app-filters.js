(function () {
  function resetFilters() {
    const searchInput = document.getElementById("searchInput");
    const citySelect = document.getElementById("citySelect");
    const typeSelect = document.getElementById("typeSelect");
    const telegramOnly = document.getElementById("telegramOnly");

    if (searchInput) searchInput.value = "";
    if (citySelect) citySelect.value = "";
    if (typeSelect) typeSelect.value = "";
    if (telegramOnly) telegramOnly.checked = false;

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }

    return true;
  }

  window.KlevbyAppFilters = {
    resetFilters
  };

  console.log("Klevby app filters loaded");
})();
