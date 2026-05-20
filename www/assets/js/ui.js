(function () {
  const shellReady = Boolean(window.KlevbyUiShell);
  const tabbarReady = Boolean(window.KlevbyUiTabbar);
  const profileBridgeReady = typeof window.openKlevbyProfile === "function";

  if (!shellReady) {
    console.warn("Klevby UI bridge: ui-shell.js не найден или загрузился позже.");
  }

  if (!tabbarReady) {
    console.warn("Klevby UI bridge: ui-tabbar.js не найден или загрузился позже.");
  }

  if (!profileBridgeReady) {
    console.warn("Klevby UI bridge: ui-profile-bridge.js не найден или загрузился позже.");
  }

  window.KlevbyUi = {
    shell: window.KlevbyUiShell || null,
    tabbar: window.KlevbyUiTabbar || null,
    profileBridgeReady
  };

  console.log("Klevby UI bridge loaded");
})();
