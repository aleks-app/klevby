(function () {
  let optionsRef = {};
  let contextMessageData = null;
  let selectedMessageRow = null;

  function getOptions() {
    return optionsRef || {};
  }

  function getElements() {
    return getOptions().elements || {};
  }

  function getCurrentUser() {
    const options = getOptions();

    if (typeof options.getCurrentUser === "function") {
      return options.getCurrentUser();
    }

    return (
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  async function refreshCurrentUser(params = {}) {
    const options = getOptions();

    if (typeof options.refreshCurrentUser === "function") {
      return await options.refreshCurrentUser(params);
    }

    return getCurrentUser();
  }

  function getMainSupabaseClient() {
    const options = getOptions();

    if (typeof options.getMainSupabaseClient === "function") {
      return options.getMainSupabaseClient();
    }

    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getCurrentChatName() { const options=getOptions(); if(typeof options.getCurrentChatName==="function") return options.getCurrentChatName(); const user=getCurrentUser(); const meta=user?.user_metadata||{}; const name=meta.nickname||meta.username||meta.display_name||meta.name||meta.full_name||localStorage.getItem("klevby_chat_username")||localStorage.getItem("klevby_author_name")||user?.email||"Рыбак"; return cleanDisplayName(name);}  
  function cleanDisplayName(value) { const options=getOptions(); if(typeof options.cleanDisplayName==="function") return options.cleanDisplayName(value); let name=String(value||"").trim(); if(!name) return ""; if(name.includes("@")) name=name.split("@")[0]; name=name.replace(/[<>]/g,"").replace(/\s+/g," ").trim(); return name.slice(0,32);}  
  function isValidSupabaseUuid(value) { const options=getOptions(); if(typeof options.isValidSupabaseUuid==="function") return options.isValidSupabaseUuid(value); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||"").trim()); }
  function cssEscape(value){const options=getOptions(); if(typeof options.cssEscape==="function") return options.cssEscape(value); if(window.CSS&&typeof window.CSS.escape==="function") return window.CSS.escape(value); return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"\\$&");}

  function findMessageDataFromRow(row) {
    const options = getOptions();
    if (typeof options.findMessageDataFromRow === "function") return options.findMessageDataFromRow(row);
    if (!row) return null;
    const mainText = row.querySelector(".chat-message-text")?.textContent?.trim() || "";
    return { id: row.dataset.messageId || "", type: row.dataset.messageType || "public", author: row.dataset.author || "Рыбак", content: row.dataset.content || "", copyText: mainText, isMine: row.dataset.isMine === "1" };
  }

  function setSelectedMessageRow(row) {
    if (selectedMessageRow && selectedMessageRow !== row) {
      selectedMessageRow.classList.remove("klevby-message-selected");
    }
    selectedMessageRow = row || null;
    if (selectedMessageRow) selectedMessageRow.classList.add("klevby-message-selected");

    const messagesContainer = getElements().messagesContainer || document.getElementById("chat-messages");
    if (messagesContainer) messagesContainer.classList.toggle("klevby-message-mode-active", Boolean(selectedMessageRow));
  }

  function showMessageMenu(row) {
    const elements = getElements();
    const messageContextMenu = elements.messageContextMenu || null;
    const contextDeleteBtn = elements.contextDeleteBtn || null;
    const contextReplyBtn = elements.contextReplyBtn || null;
    const contextCopyBtn = elements.contextCopyBtn || document.getElementById("contextCopyBtn") || null;
    const chatWindow = elements.chatWindow || document.getElementById("chat-window") || null;
    if (!messageContextMenu || !row) return;
    const data = findMessageDataFromRow(row); if (!data) return;
    contextMessageData = data;

    const canDeleteOwn = Boolean(data.isMine && data.id);
    const canReplyOther = Boolean(!data.isMine);
    const canCopy = Boolean(data.copyText);
    if (contextDeleteBtn) contextDeleteBtn.classList.toggle("hidden", !canDeleteOwn);
    if (contextReplyBtn) contextReplyBtn.classList.toggle("hidden", !canReplyOther);
    if (contextCopyBtn) contextCopyBtn.classList.toggle("hidden", !canCopy);
    if (!canDeleteOwn && !canReplyOther && !canCopy) return;

    setSelectedMessageRow(row);
    messageContextMenu.classList.remove("hidden");

    const rect = row.getBoundingClientRect();
    const bounds = chatWindow?.getBoundingClientRect?.() || { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
    const menuRect = messageContextMenu.getBoundingClientRect();
    const menuWidth = Math.max(156, menuRect.width || 172);
    const menuHeight = Math.max(90, menuRect.height || 104);
    const edgeOffset = 10;
    const isMine = data.isMine;
    let left = isMine ? rect.right - menuWidth : rect.left;
    const minLeft = bounds.left + edgeOffset;
    const maxLeft = bounds.right - menuWidth - edgeOffset;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    const belowTop = rect.bottom + 6;
    const aboveTop = rect.top - menuHeight - 6;
    const minTop = bounds.top + edgeOffset;
    const maxTop = bounds.bottom - menuHeight - edgeOffset;
    let top = belowTop <= maxTop ? belowTop : aboveTop;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;

    messageContextMenu.style.left = `${left}px`;
    messageContextMenu.style.top = `${top}px`;
  }

  function hideMessageMenu() {
    const elements = getElements();
    const messageContextMenu = elements.messageContextMenu || null;
    contextMessageData = null;
    setSelectedMessageRow(null);
    if (!messageContextMenu) return;
    messageContextMenu.classList.add("hidden");
    messageContextMenu.style.left = "";
    messageContextMenu.style.top = "";
  }

  function showCopyToast(message) {
    const toastId = "klevby-chat-copy-toast";
    let toast = document.getElementById(toastId);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = toastId;
      toast.className = "klevby-chat-copy-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => toast.classList.remove("show"), 1300);
  }

  async function copyMessageText() {
    const text = String(contextMessageData?.copyText || "").trim();
    if (!text) {
      console.error("[KlevbyCopy] missing message text", contextMessageData);
      showCopyToast("Не удалось скопировать");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const tmp = document.createElement("textarea");
        tmp.value = text; tmp.setAttribute("readonly", ""); tmp.style.position = "fixed"; tmp.style.opacity = "0";
        document.body.appendChild(tmp); tmp.focus(); tmp.select();
        const ok = document.execCommand("copy");
        tmp.remove();
        if (!ok) throw new Error("execCommand copy failed");
      }
      hideMessageMenu();
      showCopyToast("Скопировано");
    } catch (error) {
      console.error("[KlevbyCopy] copy failed", error);
      hideMessageMenu();
      showCopyToast("Не удалось скопировать");
    }
  }

  function getContextMessageData() { return contextMessageData; }

  async function deleteMessage(type, id) { /* unchanged body */
    const elements=getElements(); const messagesContainer=elements.messagesContainer||null; if(!id) return; if(!confirm("Удалить сообщение?")) return; await refreshCurrentUser({force:true}); const currentChatUser=getCurrentUser(); const client=getMainSupabaseClient(); if(!client||typeof client.from!=="function"){alert("Нет подключения к Supabase."); return;} let result; if(type==="private"){ if(!currentChatUser||!isValidSupabaseUuid(currentChatUser.id)){alert("Удалять личные сообщения можно только после входа."); return;} result=await client.from("private_messages").delete().eq("id",id).eq("sender_id",currentChatUser.id);} else { if(currentChatUser&&isValidSupabaseUuid(currentChatUser.id)){ result=await client.from("messages").delete().eq("id",id).eq("user_id",currentChatUser.id);} else { result=await client.from("messages").delete().delete().eq("id",id).eq("user_name",getCurrentChatName()); } } if(result.error){console.error("[KlevbyDelete] delete failed",{id,type,isMine:contextMessageData?.isMine,error:result.error}); alert(`Не получилось удалить сообщение: ${result.error.message||"ошибка RLS/бэкенда"}`); return;} console.info("[KlevbyDelete] delete success",{id,type}); if(messagesContainer){ const row=messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="${type}"]`); if(row){ row.remove(); } } hideMessageMenu(); }

  function init(options = {}) { optionsRef = options || {}; contextMessageData = null; setSelectedMessageRow(null); }

  window.KlevbyChatMessageActions = { init, findMessageDataFromRow, showMessageMenu, hideMessageMenu, getContextMessageData, deleteMessage, copyMessageText };
})();
