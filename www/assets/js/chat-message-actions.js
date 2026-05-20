(function () {
  let optionsRef = {};
  let contextMessageData = null;

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

  function getCurrentChatName() {
    const options = getOptions();

    if (typeof options.getCurrentChatName === "function") {
      return options.getCurrentChatName();
    }

    const user = getCurrentUser();
    const meta = user?.user_metadata || {};
    const name =
      meta.nickname ||
      meta.username ||
      meta.display_name ||
      meta.name ||
      meta.full_name ||
      localStorage.getItem("klevby_chat_username") ||
      localStorage.getItem("klevby_author_name") ||
      user?.email ||
      "Рыбак";

    return cleanDisplayName(name);
  }

  function cleanDisplayName(value) {
    const options = getOptions();

    if (typeof options.cleanDisplayName === "function") {
      return options.cleanDisplayName(value);
    }

    let name = String(value || "").trim();

    if (!name) return "";

    if (name.includes("@")) {
      name = name.split("@")[0];
    }

    name = name
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return name.slice(0, 32);
  }

  function isValidSupabaseUuid(value) {
    const options = getOptions();

    if (typeof options.isValidSupabaseUuid === "function") {
      return options.isValidSupabaseUuid(value);
    }

    const id = String(value || "").trim();

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  function cssEscape(value) {
    const options = getOptions();

    if (typeof options.cssEscape === "function") {
      return options.cssEscape(value);
    }

    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function findMessageDataFromRow(row) {
    const options = getOptions();

    if (typeof options.findMessageDataFromRow === "function") {
      return options.findMessageDataFromRow(row);
    }

    if (!row) return null;

    return {
      id: row.dataset.messageId || "",
      type: row.dataset.messageType || "public",
      author: row.dataset.author || "Рыбак",
      content: row.dataset.content || "",
      isMine: row.dataset.isMine === "1"
    };
  }

  function showMessageMenu(row) {
    const elements = getElements();
    const messageContextMenu = elements.messageContextMenu || null;
    const contextDeleteBtn = elements.contextDeleteBtn || null;

    if (!messageContextMenu || !row) return;

    const data = findMessageDataFromRow(row);

    if (!data) return;

    contextMessageData = data;

    if (contextDeleteBtn) {
      contextDeleteBtn.classList.toggle("hidden", !data.isMine || !data.id);
    }

    messageContextMenu.classList.remove("hidden");

    const rect = row.getBoundingClientRect();
    const menuWidth = 170;
    const menuHeight = 92;

    let left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - menuWidth / 2),
      window.innerWidth - menuWidth - 12
    );

    let top = rect.top - menuHeight - 8;

    if (top < 12) {
      top = rect.bottom + 8;
    }

    messageContextMenu.style.left = `${left}px`;
    messageContextMenu.style.top = `${top}px`;
  }

  function hideMessageMenu() {
    const elements = getElements();
    const messageContextMenu = elements.messageContextMenu || null;

    contextMessageData = null;

    if (!messageContextMenu) return;

    messageContextMenu.classList.add("hidden");
    messageContextMenu.style.left = "";
    messageContextMenu.style.top = "";
  }

  function getContextMessageData() {
    return contextMessageData;
  }

  async function deleteMessage(type, id) {
    const elements = getElements();
    const messagesContainer = elements.messagesContainer || null;

    if (!id) return;

    if (!confirm("Удалить сообщение?")) return;

    await refreshCurrentUser({ force: true });

    const currentChatUser = getCurrentUser();
    const client = getMainSupabaseClient();

    if (!client || typeof client.from !== "function") {
      alert("Нет подключения к Supabase.");
      return;
    }

    let result;

    if (type === "private") {
      if (!currentChatUser || !isValidSupabaseUuid(currentChatUser.id)) {
        alert("Удалять личные сообщения можно только после входа.");
        return;
      }

      result = await client
        .from("private_messages")
        .delete()
        .eq("id", id)
        .eq("sender_id", currentChatUser.id);
    } else {
      if (currentChatUser && isValidSupabaseUuid(currentChatUser.id)) {
        result = await client
          .from("messages")
          .delete()
          .eq("id", id)
          .eq("user_id", currentChatUser.id);
      } else {
        result = await client
          .from("messages")
          .delete()
          .eq("id", id)
          .eq("user_name", getCurrentChatName());
      }
    }

    if (result.error) {
      console.error("Ошибка удаления сообщения:", result.error);
      alert("Не получилось удалить сообщение. Проверь RLS delete.");
      return;
    }

    if (messagesContainer) {
      const row = messagesContainer.querySelector(
        `[data-message-id="${cssEscape(id)}"][data-message-type="${type}"]`
      );

      if (row) {
        row.remove();
      }
    }

    hideMessageMenu();
  }

  function init(options = {}) {
    optionsRef = options || {};
    contextMessageData = null;
  }

  window.KlevbyChatMessageActions = {
    init,
    findMessageDataFromRow,
    showMessageMenu,
    hideMessageMenu,
    getContextMessageData,
    deleteMessage
  };
})();
