(function () {
  function registerWindowExports(exportsMap = {}) {
    if (!exportsMap || typeof exportsMap !== "object") {
      return false;
    }

    Object.keys(exportsMap).forEach((key) => {
      if (!key) return;

      window[key] = exportsMap[key];
    });

    return true;
  }

  window.KlevbyAppWindowExports = {
    registerWindowExports
  };

  console.log("Klevby app window exports loaded", window.KlevbyAppWindowExports);
})();
