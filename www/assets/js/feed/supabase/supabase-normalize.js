(function () {
  function readBoolean(value) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === 1) return true;
    if (value === 0) return false;

    return false;
  }

  function normalizePost(row) {
    if (!row) return null;

    const likedByViewer = readBoolean(
      row.liked_by_viewer ??
      row.likedByViewer ??
      row.viewerLiked ??
      row.viewer_liked ??
      row.isLiked ??
      row.liked ??
      row.hasLiked ??
      false
    );

    return {
      type: row.type || "profile_photo",
      id: row.id,
      userId: row.user_id || "",
      authorName: row.author_name || "Рыбак",
      authorCity: row.author_city || "",
      authorTelegram: row.author_telegram || "",
      authorAvatar: row.author_avatar_url || row.author_avatar || "",
      authorAvatarUrl: row.author_avatar_url || row.author_avatar || "",
      title: row.caption || "Фото с рыбалки",
      caption: row.caption || "",
      image: row.image_url || "",
      imagePath: row.image_path || "",
      imageUrl: row.image_url || "",
      width: Number(row.image_width || 0),
      height: Number(row.image_height || 0),
      savedSizeKb: Number(row.image_size_kb || 0),
      likesCount: Number(row.likes_count || 0),
      commentsCount: Number(row.comments_count || 0),
      viewsCount: Number(row.views_count || 0),
      engagementScore: Number(row.engagement_score || 0),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      source: "supabase",

      likedByViewer,
      viewerLiked: likedByViewer,
      isLiked: likedByViewer,
      liked: likedByViewer,
      hasLiked: likedByViewer,
      liked_by_viewer: likedByViewer
    };
  }

  function applyViewerLikeState(item, liked) {
    const safeLiked = Boolean(liked);

    return {
      ...item,
      likedByViewer: safeLiked,
      viewerLiked: safeLiked,
      isLiked: safeLiked,
      liked: safeLiked,
      hasLiked: safeLiked,
      liked_by_viewer: safeLiked
    };
  }

  function getPostIds(items) {
    return Array.from(
      new Set(
        (Array.isArray(items) ? items : [])
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      )
    );
  }

  function normalizeIds(postIds) {
    return Array.from(
      new Set(
        (Array.isArray(postIds) ? postIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );
  }

  function makeZeroCountMap(postIds) {
    const counts = new Map();

    normalizeIds(postIds).forEach((id) => {
      counts.set(id, 0);
    });

    return counts;
  }

  function isDuplicateError(error) {
    const code = String(error?.code || error?.data?.code || error?.details?.code || "").trim();
    const message = String(error?.message || error?.data?.message || "").toLowerCase();
    const details = String(error?.details || error?.data?.details || "").toLowerCase();
    const hint = String(error?.hint || error?.data?.hint || "").toLowerCase();
    const constraint = String(error?.constraint || error?.data?.constraint || "").toLowerCase();

    return (
      code === "23505" ||
      code === "409" ||
      message.includes("duplicate") ||
      message.includes("unique") ||
      details.includes("duplicate") ||
      details.includes("unique") ||
      hint.includes("duplicate") ||
      hint.includes("unique") ||
      constraint.includes("unique")
    );
  }

  window.KlevbyFeedSupabaseNormalize = {
    readBoolean,
    normalizePost,
    applyViewerLikeState,
    getPostIds,
    normalizeIds,
    makeZeroCountMap,
    isDuplicateError
  };
})();
