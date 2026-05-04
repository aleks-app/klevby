(function () {
  const VAPID_PUBLIC_KEY = "BBZPSipFkHsboxaQ7UmJvZ2TJqXQa5JE59HuwS1oq-3WWhwfBtjSfrFwKe6eJvE2NoqGCEXkInaGH4nElgWsXNM";

  let context = {
    pushButton: null,
    getCurrentUser: null,
    refreshCurrentUser: null,
    getSupabaseClient: null,
    cleanDisplayName: null,
    isValidSupabaseUuid: null
  };

  function init(options = {}) {
    context = {
      ...context,
      ...options
    };

    refreshPushButtonState().catch((error) => {
      console.warn("Klevby push: не удалось обновить кнопку уведомлений:", error);
    });
  }

  function getPushButton() {
    return context.pushButton || document.getElementById("klevby-push-btn");
  }

  function getClient() {
    if (typeof context.getSupabaseClient === "function") {
      return context.getSupabaseClient();
    }

    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  async function getCurrentUser() {
    if (typeof context.refreshCurrentUser === "function") {
      await context.refreshCurrentUser();
    }

    if (typeof context.getCurrentUser === "function") {
      return context.getCurrentUser();
    }

    if (typeof window.klevbyGetCurrentUser === "function") {
      return window.klevbyGetCurrentUser();
    }

    return (
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  function cleanDisplayName(value) {
    if (typeof context.cleanDisplayName === "function") {
      return context.cleanDisplayName(value);
    }

    let name = String(value || "").trim();

    if (!name) return "";

    if (name.includes("@")) {
      name = name.split("@")[0];
    }

    return name
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
  }

  function isValidSupabaseUuid(value) {
    if (typeof context.isValidSupabaseUuid === "function") {
      return context.isValidSupabaseUuid(value);
    }

    const id = String(value || "").trim();

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  function isPushSupported() {
    return Boolean(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async function getReadyServiceWorkerRegistration() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker не поддерживается.");
    }

    try {
      const existing = await navigator.serviceWorker.getRegistration("/");

      if (existing) {
        await existing.update().catch(() => {});
      }
    } catch (error) {
      console.warn("Klevby push: не удалось проверить Service Worker:", error);
    }

    return await navigator.serviceWorker.ready;
  }

  async function savePushSubscriptionToSupabase(subscription) {
    const user = await getCurrentUser();

    if (!user || !isValidSupabaseUuid(user.id)) {
      throw new Error("Для уведомлений нужно войти в аккаунт.");
    }

    const client = getClient();

    if (!client?.from) {
      throw new Error("Supabase client не найден.");
    }

    const json = subscription.toJSON();
    const keys = json.keys || {};

    if (!json.endpoint || !keys.p256dh || !keys.auth) {
      throw new Error("Браузер не выдал данные подписки.");
    }

    const payload = {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      subscription: json,
      user_agent: navigator.userAgent || "",
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from("push_subscriptions")
      .upsert([payload], { onConflict: "endpoint" });

    if (error) {
      console.error("Klevby push: ошибка сохранения push-подписки:", error);
      throw new Error("Не удалось сохранить подписку в Supabase.");
    }

    return payload;
  }

  async function refreshPushButtonState() {
    const pushBtn = getPushButton();

    if (!pushBtn) return;

    if (!isPushSupported()) {
      pushBtn.classList.add("hidden");
      return;
    }

    pushBtn.classList.remove("hidden");
    pushBtn.classList.remove("enabled", "blocked");

    if (Notification.permission === "granted") {
      pushBtn.classList.add("enabled");
      pushBtn.textContent = "🔔";
      pushBtn.title = "Уведомления включены";
      pushBtn.setAttribute("aria-label", "Уведомления включены");
      return;
    }

    if (Notification.permission === "denied") {
      pushBtn.classList.add("blocked");
      pushBtn.textContent = "🔕";
      pushBtn.title = "Уведомления заблокированы в браузере";
      pushBtn.setAttribute("aria-label", "Уведомления заблокированы");
      return;
    }

    pushBtn.textContent = "🔔";
    pushBtn.title = "Включить уведомления";
    pushBtn.setAttribute("aria-label", "Включить уведомления");
  }

  async function saveExistingPushSubscriptionIfPossible() {
    if (!isPushSupported()) return;
    if (Notification.permission !== "granted") return;

    const user = await getCurrentUser();

    if (!user || !isValidSupabaseUuid(user.id)) return;

    try {
      const registration = await getReadyServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await savePushSubscriptionToSupabase(subscription);
      }

      await refreshPushButtonState();
    } catch (error) {
      console.warn("Klevby push: не удалось обновить существующую push-подписку:", error);
    }
  }

  async function enablePushNotifications() {
    if (!isPushSupported()) {
      alert("Этот браузер не поддерживает push-уведомления.");
      return;
    }

    const user = await getCurrentUser();

    if (!user || !isValidSupabaseUuid(user.id)) {
      alert("Сначала войди в аккаунт. Уведомления привязываются к твоему профилю.");
      return;
    }

    if (Notification.permission === "denied") {
      alert("Уведомления заблокированы в браузере. Нужно открыть настройки сайта и разрешить уведомления для klevby.com.");
      await refreshPushButtonState();
      return;
    }

    try {
      let permission = Notification.permission;

      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        await refreshPushButtonState();
        alert("Уведомления не включены. Нужно нажать «Разрешить» в окне браузера.");
        return;
      }

      const registration = await getReadyServiceWorkerRegistration();

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      await savePushSubscriptionToSupabase(subscription);
      await refreshPushButtonState();

      alert("Уведомления включены. Теперь устройство сохранено для push-уведомлений.");
    } catch (error) {
      console.error("Klevby push: ошибка включения push:", error);
      alert(error.message || "Не удалось включить уведомления.");
      await refreshPushButtonState();
    }
  }

  async function sendPushToUser(receiverUserId, senderName, messageText) {
    if (!receiverUserId || !isValidSupabaseUuid(receiverUserId)) return;

    try {
      const shortText = String(messageText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      const body = {
        user_id: String(receiverUserId),
        title: "Klevby",
        message: `${cleanDisplayName(senderName) || "Новое сообщение"}: ${shortText || "Новое личное сообщение"}`,
        url: "https://klevby.com/"
      };

      const client = getClient();

      if (client?.functions && typeof client.functions.invoke === "function") {
        const { data, error } = await client.functions.invoke("send-push", {
          body
        });

        if (error) {
          console.warn("Klevby push: push через functions.invoke не отправлен:", error);
          return;
        }

        console.log("Klevby push отправлен:", data);
      }
    } catch (error) {
      console.warn("Klevby push: уведомление не отправлено:", error);
    }
  }

  window.KlevbyChatPush = {
    init,
    isPushSupported,
    refreshPushButtonState,
    saveExistingPushSubscriptionIfPossible,
    enablePushNotifications,
    sendPushToUser
  };
})();
