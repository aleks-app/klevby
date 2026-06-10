(function markStandaloneEarly() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone) {
    document.documentElement.classList.add("pwa-standalone");
  }
})();

(function createInlineManifest() {
  const iconUrl = "assets/img/klevby-icon-512.png";

  const manifest = {
    name: "KlevGo",
    short_name: "KlevGo",
    description: "Карта клева и поиск напарника на рыбалку в Беларуси",
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  const manifestHref =
    "data:application/manifest+json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(manifest));

  const link = document.getElementById("pwaManifest");

  if (link) {
    link.setAttribute("href", manifestHref);
  }
})();
