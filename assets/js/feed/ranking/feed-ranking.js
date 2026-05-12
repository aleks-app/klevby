(function () {
  "use strict";

  const SEEN_STORAGE_PREFIX = "klevby_feed_seen_v1";
  const DEFAULT_SEEN_PENALTY = 0.45;

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeCity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function readViewerKey() {
    try {
      const core = window.KlevbyFeedSupabaseCore || {};
      if (typeof core.getViewerKey === "function") {
        return String(core.getViewerKey() || "").trim();
      }
    } catch (_) {}

    try {
      return String(localStorage.getItem("klevby_feed_viewer_key") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function resolveViewerCity(ctx = {}) {
    const directCity = normalizeCity(ctx.viewerCity);
    if (directCity) return directCity;

    const profileCore = window.KlevbyProfileCore || {};
    if (typeof profileCore.readProfileData === "function") {
      try {
        const profile = profileCore.readProfileData() || {};
        const profileCity = normalizeCity(profile.city || profile.location || "");
        if (profileCity) return profileCity;
      } catch (_) {}
    }

    return "";
  }

  function getStorageKey(viewerKey) {
    const cleanViewerKey = String(viewerKey || "anonymous").trim() || "anonymous";
    return `${SEEN_STORAGE_PREFIX}:${cleanViewerKey}`;
  }

  function readSeenState(viewerKey) {
    try {
      const raw = localStorage.getItem(getStorageKey(viewerKey));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeSeenState(viewerKey, seenState) {
    try {
      const payload = seenState && typeof seenState === "object" ? seenState : {};
      localStorage.setItem(getStorageKey(viewerKey), JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  function computeColdStartCredit(ageHours) {
    const safeAge = Math.max(0, toNumber(ageHours, 0));
    if (safeAge >= 4) return 0;
    const progress = safeAge / 4;
    return 8 * Math.pow(1 - progress, 2);
  }

  function computeColdStartBoost(ageHours) {
    const safeAge = Math.max(0, toNumber(ageHours, 0));
    if (safeAge >= 4) return 1;
    const progress = safeAge / 4;
    return 1 + 0.35 * Math.pow(1 - progress, 1.2);
  }

  function computeLocalityBoost(itemCity, viewerCity) {
    const postCity = normalizeCity(itemCity);
    const userCity = normalizeCity(viewerCity);
    if (!postCity || !userCity) return 1;
    return postCity === userCity ? 1.1 : 1;
  }

  function computeSeenPenalty(item, seenState) {
    const postId = String(item?.id || "").trim();
    if (!postId || !seenState || typeof seenState !== "object") {
      return 1;
    }

    const seen = seenState[postId];
    if (!seen || typeof seen !== "object") {
      return 1;
    }

    const likes = Math.max(0, toNumber(item?.likesCount ?? item?.likes_count, 0));
    const comments = Math.max(0, toNumber(item?.commentsCount ?? item?.comments_count, 0));
    const updatedAt = String(item?.updatedAt || item?.updated_at || "");

    const hasNewLikes = likes > toNumber(seen.likes, 0);
    const hasNewComments = comments > toNumber(seen.comments, 0);
    const hasUpdatedAt = updatedAt && seen.updatedAt && updatedAt !== seen.updatedAt;

    if (hasNewLikes || hasNewComments || hasUpdatedAt) {
      return 0.8;
    }

    return DEFAULT_SEEN_PENALTY;
  }

  function computeFeedScore(item, ctx = {}) {
    const likes = Math.max(0, toNumber(item?.likesCount ?? item?.likes_count, 0));
    const comments = Math.max(0, toNumber(item?.commentsCount ?? item?.comments_count, 0));
    const saves = Math.max(0, toNumber(item?.savesCount ?? item?.saves_count ?? item?.sharesCount ?? item?.shares_count, 0));

    const createdAtRaw = String(item?.createdAt || item?.created_at || "").trim();
    const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;
    const nowMs = toNumber(ctx.nowMs, Date.now());
    const ageHours = Number.isFinite(createdAtMs)
      ? Math.max(0, (nowMs - createdAtMs) / 3600000)
      : 24;

    const coldStartCredit = computeColdStartCredit(ageHours);
    const coldStartBoost = computeColdStartBoost(ageHours);
    const viewerCity = resolveViewerCity(ctx);
    const localityBoost = computeLocalityBoost(item?.authorCity || item?.author_city || "", viewerCity);
    const seenPenalty = computeSeenPenalty(item, ctx.seenState || {});

    const baseScore = likes + comments * 2 + saves * 5 + coldStartCredit;
    const timeDecay = Math.pow(ageHours + 2, 1.5);

    return (baseScore / timeDecay) * coldStartBoost * localityBoost * seenPenalty;
  }

  function rankFeedItems(items, ctx = {}) {
    const list = Array.isArray(items) ? items.slice() : [];
    const viewerKey = String(ctx.viewerKey || readViewerKey() || "anonymous").trim() || "anonymous";
    const seenState = ctx.seenState || readSeenState(viewerKey);
    const nowMs = Date.now();

    return list
      .map((item, index) => ({
        item,
        index,
        score: computeFeedScore(item, {
          ...ctx,
          nowMs,
          viewerKey,
          seenState
        })
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const aCreated = Date.parse(String(a.item?.createdAt || a.item?.created_at || "")) || 0;
        const bCreated = Date.parse(String(b.item?.createdAt || b.item?.created_at || "")) || 0;
        if (bCreated !== aCreated) return bCreated - aCreated;

        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }

  function markPostSeen(postId, itemSnapshot = {}, options = {}) {
    const cleanPostId = String(postId || itemSnapshot?.id || "").trim();
    if (!cleanPostId) return false;

    const viewerKey = String(options.viewerKey || readViewerKey() || "anonymous").trim() || "anonymous";
    const seenState = readSeenState(viewerKey);

    seenState[cleanPostId] = {
      seenAt: new Date().toISOString(),
      likes: Math.max(0, toNumber(itemSnapshot?.likesCount ?? itemSnapshot?.likes_count, 0)),
      comments: Math.max(0, toNumber(itemSnapshot?.commentsCount ?? itemSnapshot?.comments_count, 0)),
      updatedAt: String(itemSnapshot?.updatedAt || itemSnapshot?.updated_at || "")
    };

    return writeSeenState(viewerKey, seenState);
  }

  window.KlevbyFeedRanking = {
    computeFeedScore,
    rankFeedItems,
    computeColdStartCredit,
    computeColdStartBoost,
    computeLocalityBoost,
    computeSeenPenalty,
    readSeenState,
    writeSeenState,
    markPostSeen
  };

  console.log("Klevby feed ranking module loaded");
})();
