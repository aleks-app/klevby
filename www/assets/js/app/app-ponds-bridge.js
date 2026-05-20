(function () {
  let pondsReloadTimer = null;
  let pondsReloadInProgress = false;
  let lastPondsReloadAt = 0;

  function getSyncGlobalAuthState(dependencies = {}) {
    if (typeof dependencies.syncGlobalAuthState === "function") {
      return dependencies.syncGlobalAuthState;
    }

    if (typeof window.syncGlobalAuthState === "function") {
      return window.syncGlobalAuthState;
    }

    return null;
  }

  async function runPondsLoaders(dependencies = {}) {
    const syncAuth = getSyncGlobalAuthState(dependencies);

    if (typeof syncAuth === "function") {
      syncAuth();
    }

    if (typeof window.klevbyInitPonds === "function") {
      window.klevbyInitPonds();
      return;
    }

    if (typeof window.klevbyLoadPonds === "function") {
      await window.klevbyLoadPonds();
      return;
    }

    if (typeof window.loadPonds === "function") {
      await window.loadPonds();
    }
  }

  function reloadPondsIfReady(options = {}, dependencies = {}) {
    const force = Boolean(options.force);
    const delay = Number(options.delay || 450);

    clearTimeout(pondsReloadTimer);

    pondsReloadTimer = setTimeout(async () => {
      const now = Date.now();

      if (!force && pondsReloadInProgress) return;
      if (!force && now - lastPondsReloadAt < 1600) return;

      pondsReloadInProgress = true;
      lastPondsReloadAt = now;

      try {
        await runPondsLoaders(dependencies);
      } catch (error) {
        console.warn("Klevby ponds: не удалось обновить раздел прудов:", error);
      } finally {
        pondsReloadInProgress = false;
      }
    }, delay);

    return true;
  }

  window.KlevbyAppPondsBridge = {
    reloadPondsIfReady
  };

  console.log("Klevby app ponds bridge loaded", window.KlevbyAppPondsBridge);
})();
