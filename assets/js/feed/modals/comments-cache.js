(function () {
  "use strict";

  const commentsCacheByPostId = new Map();

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
  }

  function getCommentsCounts() {
    return window.KlevbyFeedCommentsCounts || window.KlevbyFeedCommentCounts || {};
  }

  function getSafeCommentsCount(value) {
    const utils = getCommentsUtils();

    if (typeof utils.getSafeCommentsCount === "function") {
      return utils.getSafeCommentsCount(value);
    }

    return Math.max(0, Number(value || 0) || 0);
  }

  function syncFeedCommentCount(postId, commentsCount) {
    const counts = getCommentsCounts();
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return safeCount;

    if (typeof counts.syncFeedCommentCount === "function") {
      return counts.syncFeedCommentCount(cleanId, safeCount);
    }

    if (typeof window.klevbySyncFeedCommentCount === "function") {
      return window.klevbySyncFeedCommentCount(cleanId, safeCount);
    }

    return safeCount;
  }

  function normalizeComments(comments) {
    if (!Array.isArray(comments)) return [];

    return comments
      .filter(Boolean)
      .map((comment) => {
        return {
          ...comment,
          id: comment.id || "",
          post_id: comment.post_id || comment.postId || "",
          user_id: comment.user_id || comment.userId || "",
          author_name: comment.author_name || comment.authorName || "Рыбак",
          author_city: comment.author_city || comment.authorCity || "",
          author_telegram: comment.author_telegram || comment.authorTelegram || "",
          text: comment.text || "",
          created_at: comment.created_at || comment.createdAt || "",
          updated_at: comment.updated_at || comment.updatedAt || ""
        };
      });
  }

  function normalizeCommentsResult(result) {
    if (Array.isArray(result)) {
      return normalizeComments(result);
    }

    if (Array.isArray(result?.comments)) {
      return normalizeComments(result.comments);
    }

    if (Array.isArray(result?.data)) {
      return normalizeComments(result.data);
    }

    if (Array.isArray(result?.result?.comments)) {
      return normalizeComments(result.result.comments);
    }

    return [];
  }

  function getCachedComments(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const cached = commentsCacheByPostId.get(cleanId);

    return Array.isArray(cached) ? cached : [];
  }

  function setCachedComments(postId, comments) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const safeComments = normalizeComments(comments);

    commentsCacheByPostId.set(cleanId, safeComments);
    syncFeedCommentCount(cleanId, safeComments.length);

    return safeComments;
  }

  function appendCachedComment(postId, comment) {
    const cleanId = String(postId || "").trim();

    if (!cleanId || !comment) return getCachedComments(cleanId);

    const cached = getCachedComments(cleanId);
    const commentId = String(comment.id || "").trim();

    if (commentId && cached.some((item) => String(item?.id || "") === commentId)) {
      syncFeedCommentCount(cleanId, cached.length);
      return cached;
    }

    const nextComments = normalizeComments([
      ...cached,
      comment
    ]);

    commentsCacheByPostId.set(cleanId, nextComments);
    syncFeedCommentCount(cleanId, nextComments.length);

    return nextComments;
  }

  function removeCachedComment(postId, commentId) {
    const cleanPostId = String(postId || "").trim();
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanPostId || !cleanCommentId) {
      return getCachedComments(cleanPostId);
    }

    const nextComments = getCachedComments(cleanPostId).filter((comment) => {
      return String(comment?.id || "") !== cleanCommentId;
    });

    commentsCacheByPostId.set(cleanPostId, nextComments);
    syncFeedCommentCount(cleanPostId, nextComments.length);

    return nextComments;
  }

  function clearCachedComments(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    commentsCacheByPostId.delete(cleanId);
  }

  function getCommentsCacheSize() {
    return commentsCacheByPostId.size;
  }

  const commentsCache = {
    normalizeComments,
    normalizeCommentsResult,

    getCachedComments,
    setCachedComments,
    appendCachedComment,
    removeCachedComment,
    clearCachedComments,
    getCommentsCacheSize,

    syncFeedCommentCount
  };

  window.KlevbyFeedCommentsCache = commentsCache;
  window.KlevbyFeedCommentCache = commentsCache;
})();
