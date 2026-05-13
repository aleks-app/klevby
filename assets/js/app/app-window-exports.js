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

  function registerAppWindowExports(exportMapFactory) {
    const exportsMap = typeof exportMapFactory === "function"
      ? exportMapFactory()
      : exportMapFactory;

    return registerWindowExports(exportsMap);
  }

  window.KlevbyAppWindowExports = {
    registerWindowExports,
    registerAppWindowExports
  };

  console.log("Klevby app window exports loaded", window.KlevbyAppWindowExports);
})();
