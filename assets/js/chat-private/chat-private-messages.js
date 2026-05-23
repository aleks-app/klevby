(function () {
  if (window.KlevbyChatPrivateMessages) return;

  function buildPrivateMessagesEndpoint({ supabaseUrl, currentUserId, peerId }) {
    const baseUrl = String(supabaseUrl || "").trim().replace(/\/$/, "");
    return (
      `${baseUrl}/rest/v1/private_messages?select=*` +
      `&or=(and(sender_id.eq.${encodeURIComponent(currentUserId)},receiver_id.eq.${encodeURIComponent(peerId)}),and(sender_id.eq.${encodeURIComponent(peerId)},receiver_id.eq.${encodeURIComponent(currentUserId)}))` +
      "&order=created_at.asc"
    );
  }

  async function fetchPrivateDialogMessages({ endpoint, supabaseAnonKey, accessToken, fetchFn }) {
    const startedAt = Date.now();
    console.info("[KlevbyPrivate] private_messages dialog REST start", { endpoint });

    const response = await fetchFn(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    const durationMs = Date.now() - startedAt;
    let body = null;
    try { body = await response.json(); } catch (_) { body = null; }

    if (!response.ok) {
      console.warn("[KlevbyPrivate] private_messages dialog REST fail", { status: response.status, durationMs, body });
      return { data: null, error: { status: response.status, body } };
    }

    console.info("[KlevbyPrivate] private_messages dialog REST end", { status: response.status, durationMs, rows: Array.isArray(body) ? body.length : 0 });
    return { data: Array.isArray(body) ? body : [], error: null };
  }

  function normalizePrivateDialogMessages(data) {
    return Array.isArray(data) ? data : [];
  }

  function buildPrivateMessagePayload({ currentUserId, peerId, senderName, content }) {
    return {
      sender_id: currentUserId,
      receiver_id: peerId,
      sender_name: senderName,
      content
    };
  }

  async function sendPrivateMessageRest({ supabaseUrl, supabaseAnonKey, accessToken, payload, fetchFn }) {
    const endpoint = `${String(supabaseUrl || "").trim().replace(/\/$/, "")}/rest/v1/private_messages`;
    const startedAt = Date.now();
    console.info("[KlevbyPrivate] send REST start", { endpoint, peerId: payload?.receiver_id || "" });

    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const durationMs = Date.now() - startedAt;
    let responseBody = null;
    try { responseBody = await response.json(); } catch (_) { responseBody = null; }
    console.info("[KlevbyPrivate] send REST end", { status: response.status, durationMs });

    return { response, responseBody, durationMs };
  }

  window.KlevbyChatPrivateMessages = {
    buildPrivateMessagesEndpoint,
    fetchPrivateDialogMessages,
    normalizePrivateDialogMessages,
    buildPrivateMessagePayload,
    sendPrivateMessageRest
  };
})();
