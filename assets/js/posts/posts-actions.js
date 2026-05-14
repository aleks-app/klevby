(function () {
  const POSTS_ACTIONS_VERSION = "20260515-posts-actions-split-1";

  function getApi() {
    return window.KlevbyPostsApi || {};
  }

  function getSupabaseClientSafe() {
    const api = getApi();

    if (typeof api.getSupabaseClientSafe === "function") {
      return api.getSupabaseClientSafe();
    }

    if (typeof window.getSupabaseClientSafe === "function" && window.getSupabaseClientSafe !== getSupabaseClientSafe) {
      return window.getSupabaseClientSafe();
    }

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      return supabaseClient;
    }

    return (
      window.supabaseClient ||
      window.klevbySupabase ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  async function loadPosts(options = {}) {
    const api = getApi();

    if (typeof api.loadPosts === "function") {
      return api.loadPosts(options);
    }

    if (typeof window.loadPosts === "function" && window.loadPosts !== loadPosts) {
      return window.loadPosts(options);
    }

    return null;
  }

  async function toggleCrewFull(id, value) {
    const db = getSupabaseClientSafe();

    if (!db) {
      alert("Supabase ещё не готов. Обнови страницу.");
      return;
    }

    const { error } = await db
      .from("posts")
      .update({ crew_full: value })
      .eq("id", id);

    if (error) {
      alert("Не получилось изменить статус. Проверь поле crew_full и RLS.");
      console.error("Ошибка crew_full:", error);
      return;
    }

    await loadPosts({ force: true });
  }

  async function deletePost(id) {
    if (!confirm("Удалить объявление? Это действие нельзя отменить.")) {
      return;
    }

    const db = getSupabaseClientSafe();

    if (!db) {
      alert("Supabase ещё не готов. Обнови страницу.");
      return;
    }

    const { error } = await db
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Не получилось удалить. Удалять может только владелец объявления или админ.");
      console.error("Ошибка удаления posts:", error);
      return;
    }

    await loadPosts({ force: true });

    if (typeof window.klevbyReloadMap === "function") {
      window.klevbyReloadMap();
    }
  }

  window.KlevbyPostsActions = {
    toggleCrewFull,
    deletePost
  };

  console.log("Klevby posts actions loaded", {
    version: POSTS_ACTIONS_VERSION
  });
})();
