(function () {
  if (window.KlevbyChatPrivateList) return;

  function renderPrivateDialogAvatar(peer, helpers = {}) {
    const peerName = String(peer?.name || "Рыбак");
    const avatarUrl = helpers.normalizePrivateAvatarUrl?.(peer?.avatarUrl || "") || "";
    const initials = helpers.escapeHtml?.(helpers.getInitials?.(peerName) || "Р") || "Р";

    if (!avatarUrl) {
      return `<span class="klevby-private-dialog-avatar">${initials}</span>`;
    }

    const safeAvatarUrl = helpers.escapeHtml?.(avatarUrl) || "";
    const safePeerName = helpers.escapeHtml?.(peerName) || "Рыбак";

    return `
      <span
        class="klevby-private-dialog-avatar klevby-private-dialog-avatar-image"
        aria-label="${safePeerName}"
        style="overflow:hidden;padding:0;"
      >
        <img
          src="${safeAvatarUrl}"
          alt=""
          loading="lazy"
          decoding="async"
          style="width:100%;height:100%;display:block;object-fit:cover;object-position:center;border-radius:inherit;"
        >
      </span>
    `;
  }

  function buildPrivateDialogItem(peer, helpers = {}) {
    const preview = peer.lastMessage
      ? helpers.parseReplyContent?.(peer.lastMessage)?.mainText || ""
      : "Нажми, чтобы открыть переписку";
    const peerId = helpers.escapeHtml?.(peer.id) || "";
    const peerName = helpers.escapeHtml?.(peer.name) || "Рыбак";
    const peerTime = helpers.escapeHtml?.(peer.lastTime || "") || "";
    const peerPreview = helpers.escapeHtml?.(preview) || "";
    const peerUnreadCount = Number(peer.unreadCount) || 0;

    return `
      <button class="klevby-private-dialog-item ${peerUnreadCount > 0 ? "has-unread" : ""}" type="button" data-peer-id="${peerId}" data-peer-name="${peerName}">
        ${renderPrivateDialogAvatar(peer, helpers)}

        <span class="klevby-private-dialog-main">
          <span class="klevby-private-dialog-top">
            <span class="klevby-private-dialog-name">${peerName}</span>
            <span class="klevby-private-dialog-time">${peerTime}</span>
          </span>

          <span class="klevby-private-dialog-bottom">
            <span class="klevby-private-dialog-preview">${peerPreview}</span>
            ${peerUnreadCount > 0 ? `<span class="klevby-private-unread-dot">${helpers.escapeHtml?.(peerUnreadCount) || peerUnreadCount}</span>` : ""}
          </span>
        </span>

        <span class="klevby-private-status ${helpers.isOnline?.(peer.id) ? "online" : ""}"></span>
      </button>
    `;
  }

  function renderPrivateDialogList(peers, helpers = {}) {
    const list = document.createElement("div");
    list.className = "klevby-private-dialog-list";
    list.innerHTML = (peers || []).map((peer) => buildPrivateDialogItem(peer, helpers)).join("");
    return list;
  }

  window.KlevbyChatPrivateList = {
    buildPrivateDialogItem,
    renderPrivateDialogAvatar,
    renderPrivateDialogList
  };
})();
