(function () {
  if (window.KlevbyChatPrivateDialog) return;

  function renderPrivateHeaderAvatar(peer, helpers = {}) {
    const chatAvatar = helpers.getElement?.("chatAvatar");
    if (!chatAvatar) return;

    const peerName = String(peer?.name || "Рыбак");
    const avatarUrl = helpers.normalizePrivateAvatarUrl?.(peer?.avatarUrl || "") || "";

    chatAvatar.textContent = "";
    chatAvatar.innerHTML = "";
    chatAvatar.classList.remove("klevby-chat-avatar-image");

    if (!avatarUrl) {
      chatAvatar.textContent = helpers.getInitials?.(peerName) || "Р";
      return;
    }

    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = "cover";
    img.style.objectPosition = "center";
    img.style.borderRadius = "inherit";

    chatAvatar.classList.add("klevby-chat-avatar-image");
    chatAvatar.appendChild(img);
  }

  function resetPrivateHeaderAvatar(value = "✉", helpers = {}) {
    const chatAvatar = helpers.getElement?.("chatAvatar");
    if (!chatAvatar) return;

    chatAvatar.classList.remove("klevby-chat-avatar-image");
    chatAvatar.innerHTML = "";
    chatAvatar.textContent = value;
  }

  function createSelectedPeerState(peerId, peerName, helpers = {}) {
    const safePeerId = String(peerId || "").trim();

    return {
      id: safePeerId,
      name: helpers.getProfileName?.(safePeerId, peerName || "Рыбак") || String(peerName || "Рыбак"),
      avatarUrl: helpers.getPrivateProfileAvatar?.(safePeerId) || ""
    };
  }

  function normalizePrivateDialogMessages(data) {
    return Array.isArray(data) ? data : [];
  }

  window.KlevbyChatPrivateDialog = {
    renderPrivateHeaderAvatar,
    resetPrivateHeaderAvatar,
    createSelectedPeerState,
    normalizePrivateDialogMessages
  };
})();
