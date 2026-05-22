(function () {
  const root = window.KlevbyMarket || (window.KlevbyMarket = {});

  function escapeHtml(value) {
    if (typeof root.escapeHtml === "function") {
      return root.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTelegram(value) {
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

  function formatBelarusPhone(rawDigits) {
    const digits = String(rawDigits || "").replace(/\D/g, "").slice(0, 9);
    if (digits.length !== 9) return "";

    const operator = digits.slice(0, 2);
    const part1 = digits.slice(2, 5);
    const part2 = digits.slice(5, 7);
    const part3 = digits.slice(7, 9);

    let formatted = "+375";
    if (operator) formatted += ` (${operator}`;
    if (operator.length === 2) formatted += ")";
    if (part1) formatted += ` ${part1}`;
    if (part2) formatted += `-${part2}`;
    if (part3) formatted += `-${part3}`;

    return formatted;
  }

  function normalizePhone(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";

    const localDigits = (digits.startsWith("375") ? digits.slice(3) : digits).slice(0, 9);
    if (localDigits.length !== 9) return "";

    return formatBelarusPhone(localDigits);
  }

  function normalizeMessengerNumber(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeWhatsapp(value) {
    const raw = String(value || "").trim();

    if (!raw) return "";

    const waMatch = raw.match(/wa\.me\/([0-9]+)/i);
    if (waMatch && waMatch[1]) {
      return waMatch[1];
    }

    return normalizeMessengerNumber(raw);
  }

  function normalizeViber(value) {
    const raw = String(value || "").trim();

    if (!raw) return "";

    const viberMatch = raw.match(/number=\+?([0-9]+)/i);
    if (viberMatch && viberMatch[1]) {
      return viberMatch[1];
    }

    return normalizeMessengerNumber(raw);
  }

  function marketTelegramLink(username) {
    return username ? `https://t.me/${username}` : "";
  }

  function marketTelLink(phone) {
    if (!phone) return "";
    const normalized = normalizePhone(phone);
    if (!normalized) return "";
    return `tel:${normalized.replace(/[^\d+]/g, "")}`;
  }

  function marketWhatsAppLink(whatsapp) {
    return whatsapp ? `https://wa.me/${whatsapp}` : "";
  }

  function marketViberLink(viber) {
    return viber ? `viber://chat?number=%2B${viber}` : "";
  }

  function resolveMarketContacts(item) {
    const source = item || {};

    const telegram = normalizeTelegram(
      source.contact_telegram || source.contact || source.telegram || ""
    );
    const phone = normalizePhone(source.contact_phone || "");
    const whatsapp = normalizeWhatsapp(source.contact_whatsapp || "");
    const viber = normalizeViber(source.contact_viber || "");

    return {
      phone,
      telegram,
      viber,
      whatsapp,
      hasAny: Boolean(phone || telegram || viber || whatsapp)
    };
  }

  function marketContactCtaHtml(itemOrContacts, options) {
    const opts = options || {};
    const contacts = itemOrContacts && typeof itemOrContacts === "object" && Object.prototype.hasOwnProperty.call(itemOrContacts, "hasAny")
      ? itemOrContacts
      : resolveMarketContacts(itemOrContacts || {});

    if (!contacts.hasAny) {
      return `<span class="market-contact-missing">Контакт не указан</span>`;
    }

    const stopPropagation = opts.stopPropagation ? "event.stopPropagation(); " : "";
    const ctas = [];

    if (contacts.telegram) {
      ctas.push(
        `<button class="small-btn green" type="button" onclick="${stopPropagation}window.open('${escapeHtml(marketTelegramLink(contacts.telegram))}','_blank')">Telegram</button>`
      );
    }

    if (contacts.phone) {
      ctas.push(
        `<button class="small-btn gray" type="button" onclick="${stopPropagation}window.location.href='${escapeHtml(marketTelLink(contacts.phone))}'">Позвонить</button>`
      );
    }

    if (contacts.whatsapp) {
      ctas.push(
        `<button class="small-btn gray" type="button" onclick="${stopPropagation}window.open('${escapeHtml(marketWhatsAppLink(contacts.whatsapp))}','_blank')">WhatsApp</button>`
      );
    }

    if (contacts.viber) {
      ctas.push(
        `<button class="small-btn gray" type="button" onclick="${stopPropagation}window.location.href='${escapeHtml(marketViberLink(contacts.viber))}'">Viber</button>`
      );
    }

    return ctas.join("");
  }

  root.cleanMarketContact = normalizeTelegram;
  root.normalizeMarketTelegram = normalizeTelegram;
  root.normalizeMarketPhone = normalizePhone;
  root.normalizeMarketViber = normalizeViber;
  root.normalizeMarketWhatsapp = normalizeWhatsapp;
  root.marketTelegramLink = marketTelegramLink;
  root.marketTelLink = marketTelLink;
  root.marketWhatsAppLink = marketWhatsAppLink;
  root.marketViberLink = marketViberLink;
  root.resolveMarketContacts = resolveMarketContacts;
  root.marketContactCtaHtml = marketContactCtaHtml;
})();
