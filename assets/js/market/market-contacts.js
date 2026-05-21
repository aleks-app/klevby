(function () {
  const root = window.KlevbyMarket || (window.KlevbyMarket = {});

  function cleanMarketContact(value) {
    let v = String(value || "").trim();

    v = v.replace(/^@/, "");
    v = v.replace(/^https?:\/\/t\.me\//i, "");
    v = v.replace(/^https?:\/\/telegram\.me\//i, "");
    v = v.replace(/^t\.me\//i, "");
    v = v.split("?")[0];
    v = v.split("/")[0];
    v = v.replace(/[^a-zA-Z0-9_]/g, "");

    return v;
  }

  function marketTelegramLink(username) {
    return `https://t.me/${username}`;
  }

  function marketContactCtaHtml(contact, options) {
    const opts = options || {};
    const escapedContact = typeof root.escapeHtml === "function" ? root.escapeHtml(contact) : String(contact || "");

    if (!contact) {
      return `<span class="market-contact-missing">Контакт не указан</span>`;
    }

    const text = opts.text || "Написать";
    const stopPropagation = opts.stopPropagation ? "event.stopPropagation(); " : "";

    return `<button class="small-btn green" type="button" onclick="${stopPropagation}window.open('${marketTelegramLink(escapedContact)}','_blank')">${text}</button>`;
  }

  root.cleanMarketContact = cleanMarketContact;
  root.marketTelegramLink = marketTelegramLink;
  root.marketContactCtaHtml = marketContactCtaHtml;
})();
