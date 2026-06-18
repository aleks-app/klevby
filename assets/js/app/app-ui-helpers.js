(function () {
  function showStatus(message, isError = false) {
    console[isError ? "warn" : "info"]("[Trips] status", message);
  }

  window.KlevbyAppUiHelpers = { showStatus };
})();
