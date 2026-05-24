(function () {
  let optionsRef = {};
  let contextMessageData = null;
  let selectedMessageRow = null;
  let isMenuOpen = false;

  function getOptions() { return optionsRef || {}; }
  function getElements() { return getOptions().elements || {}; }
  function log(...args) { console.info("[KlevbyMenu]", ...args); }

  function getCurrentUser() {
    const options = getOptions();
    if (typeof options.getCurrentUser === "function") return options.getCurrentUser();
    return window.klevbyCurrentUser || window.currentUser || window.klevbyUser || null;
  }
  async function refreshCurrentUser(params = {}) { const options = getOptions(); if (typeof options.refreshCurrentUser === "function") return await options.refreshCurrentUser(params); return getCurrentUser(); }
  function getMainSupabaseClient() { const options = getOptions(); if (typeof options.getMainSupabaseClient === "function") return options.getMainSupabaseClient(); return window.klevbySupabase || window.supabaseClient || (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) || null; }
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
    if (selectedMessageRow && selectedMessageRow !== row) selectedMessageRow.classList.remove("klevby-message-selected");
    selectedMessageRow = row || null;
    if (selectedMessageRow) selectedMessageRow.classList.add("klevby-message-selected");
    const messagesContainer = getElements().messagesContainer || document.getElementById("chat-messages");
    if (messagesContainer) messagesContainer.classList.toggle("klevby-message-mode-active", Boolean(selectedMessageRow));
  }

  function cleanupMenuState(reason = "unknown") {
    const elements = getElements();
    const messageContextMenu = elements.messageContextMenu || null;
    log("cleanup", { reason });
    contextMessageData = null;
    isMenuOpen = false;
    setSelectedMessageRow(null);
    if (!messageContextMenu) return;
    messageContextMenu.classList.add("hidden");
    messageContextMenu.style.left = "";
    messageContextMenu.style.top = "";
  }

  function resolveLiveMessageRow() {
    if (selectedMessageRow && selectedMessageRow.isConnected) return selectedMessageRow;
    const elements = getElements();
    const messagesContainer = elements.messagesContainer || document.getElementById("chat-messages");
    if (!messagesContainer) return null;
    const selected = messagesContainer.querySelector(".chat-message-row.klevby-message-selected");
    if (selected?.isConnected) return selected;
    if (contextMessageData?.id) {
      const selector = `[data-message-id="${cssEscape(contextMessageData.id)}"][data-message-type="${cssEscape(contextMessageData.type || "public")}"]`;
      const byId = messagesContainer.querySelector(selector);
      if (byId?.isConnected) return byId;
    }
    return null;
  }

  function resolveActionContext(actionName = "action") {
    const liveRow = resolveLiveMessageRow();
    const liveData = liveRow ? findMessageDataFromRow(liveRow) : null;
    const hasLiveData = Boolean(liveData?.id && liveData?.type);
    const fallbackData = contextMessageData?.id ? contextMessageData : null;
    log("action click", { action: actionName, liveFound: Boolean(liveRow), hasLiveData, hasFallback: Boolean(fallbackData) });
    if (hasLiveData) return { row: liveRow, data: liveData, source: "live" };
    if (fallbackData) return { row: null, data: fallbackData, source: "fallback" };
    console.error("[KlevbyMenu] action failed due to stale/missing context", { action: actionName });
    cleanupMenuState(`invalid_context:${actionName}`);
    return null;
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
    cleanupMenuState("before_open");
    contextMessageData = data;
    isMenuOpen = true;
    log("open", { id: data.id, type: data.type, isMine: data.isMine });

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
    let left = data.isMine ? rect.right - menuWidth : rect.left;
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

  function hideMessageMenu(reason = "manual") { cleanupMenuState(reason); }

  function replyToSelectedMessage() {
    const resolved = resolveActionContext("reply");
    if (!resolved?.data) return null;
    cleanupMenuState("reply_selected");
    return resolved.data;
  }

  function showCopyToast(message) { const toastId = "klevby-chat-copy-toast"; let toast = document.getElementById(toastId); if (!toast) { toast = document.createElement("div"); toast.id = toastId; toast.className = "klevby-chat-copy-toast"; document.body.appendChild(toast);} toast.textContent = message; toast.classList.add("show"); clearTimeout(toast.__hideTimer); toast.__hideTimer = setTimeout(() => toast.classList.remove("show"), 1300); }

  async function copyMessageText() {
    const resolved = resolveActionContext("copy");
    const text = String(resolved?.data?.copyText || "").trim();
    if (!text) { console.error("[KlevbyCopy] missing message text", resolved?.data || contextMessageData); showCopyToast("Не удалось скопировать"); cleanupMenuState("copy_missing_text"); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else { const tmp = document.createElement("textarea"); tmp.value = text; tmp.setAttribute("readonly", ""); tmp.style.position = "fixed"; tmp.style.opacity = "0"; document.body.appendChild(tmp); tmp.focus(); tmp.select(); const ok = document.execCommand("copy"); tmp.remove(); if (!ok) throw new Error("execCommand copy failed"); }
      cleanupMenuState("copy_success"); showCopyToast("Скопировано");
    } catch (error) { console.error("[KlevbyCopy] copy failed", error); cleanupMenuState("copy_failed"); showCopyToast("Не удалось скопировать"); }
  }

  function getContextMessageData() { return contextMessageData; }

  async function deleteMessage(type, id) {
    const resolved = !type && !id ? resolveActionContext("delete") : null;
    const liveType = resolved?.data?.type || type;
    const liveId = resolved?.data?.id || id;
    const liveIsMine = resolved?.data?.isMine;
    if (!liveId) { console.error("[KlevbyDelete] missing message id", { type: liveType, id: liveId }); alert("DELETE DEBUG: missing liveId"); cleanupMenuState("delete_missing_id"); return; }
    if (liveIsMine === false) { console.error("[KlevbyDelete] blocked delete for чужое сообщение", { id: liveId, type: liveType, isMine: liveIsMine }); alert(`DELETE DEBUG: blocked not mine
liveType=${liveType}
liveId=${liveId}
liveIsMine=${liveIsMine}`); cleanupMenuState("delete_not_mine"); return; }
    const elements=getElements(); const messagesContainer=elements.messagesContainer||null; if(!confirm("Удалить сообщение?")) return; await refreshCurrentUser({force:true}); const currentChatUser=getCurrentUser(); const client=getMainSupabaseClient(); if(!client||typeof client.from!=="function"){alert("Нет подключения к Supabase."); return;} let authUser=null; let authUserError=null; if(!isValidSupabaseUuid(currentChatUser?.id)&&client?.auth?.getUser){ try{ const { data, error }=await client.auth.getUser(); authUserError=error||null; if(!error&&isValidSupabaseUuid(data?.user?.id)) authUser=data.user; }catch(error){ authUserError=error; }} let result; const currentChatUserId=currentChatUser?.id||null; const currentChatUserIdValid=isValidSupabaseUuid(currentChatUserId); const deleteUser=authUser||currentChatUser||null; const deleteUserId=deleteUser?.id||null; const deleteUserIdValid=isValidSupabaseUuid(deleteUserId); const deleteUserSource=authUser?"supabase-auth-user":(currentChatUserIdValid?"cached-current-user":"user-name-fallback"); let deletePath="public-user-name-fallback"; if(liveType==="private"){ deletePath=`private-${deleteUserSource}`; } else if(deleteUserIdValid){ deletePath=`public-user-id-${deleteUserSource}`; } console.info("[KlevbyDelete] delete request",{liveType,liveId,liveIsMine,currentChatUserId,currentChatUserIdValid,authUserId:authUser?.id||null,authUserError:authUserError?String(authUserError?.message||authUserError):null,deleteUserId,deleteUserIdValid,deleteUserSource,currentChatName:getCurrentChatName(),deletePath}); if(liveType==="private"){ if(!deleteUserIdValid){alert(`DELETE DEBUG: invalid deleteUserId for private
deleteUserSource=${deleteUserSource}
deleteUserIdValid=${deleteUserIdValid}`); return;} result=await client.from("private_messages").delete().eq("id",liveId).eq("sender_id",deleteUserId);} else { if(deleteUserIdValid){ result=await client.from("messages").delete().eq("id",liveId).eq("user_id",deleteUserId);} else { result=await client.from("messages").delete().eq("id",liveId).eq("user_name",getCurrentChatName()); } } if(result.error){console.error("[KlevbyDelete] delete failed",{id:liveId,type:liveType,isMine:liveIsMine,deletePath,error:result.error}); alert(`DELETE DEBUG: Supabase error: ${result.error.message||"unknown"}`); return;} console.info("[KlevbyDelete] delete success",{id:liveId,type:liveType,deletePath,result}); alert(`DELETE DEBUG: request success path=${deletePath}`); if(messagesContainer){ const row=messagesContainer.querySelector(`[data-message-id="${cssEscape(liveId)}"][data-message-type="${liveType}"]`); if(row){ row.remove(); } else { alert(`DELETE DEBUG: server ok but local row not found
liveId=${liveId}
liveType=${liveType}`); } } cleanupMenuState("delete_success"); }

  function init(options = {}) { optionsRef = options || {}; cleanupMenuState("init"); }
  // Action menu ownership:
  // - context message resolution
  // - selection/menu visibility state
  // - copy/reply/delete action handlers

  window.KlevbyChatMessageActions = { init, findMessageDataFromRow, showMessageMenu, hideMessageMenu, getContextMessageData, deleteMessage, copyMessageText, resolveActionContext, cleanupMenuState, replyToSelectedMessage };
})();
