(function (window) {
  if (!window) return;

  const KLEVB_APP_RESUME_DEBOUNCE_MS = 650;
  const KLEVB_APP_RESUME_MIN_INTERVAL_MS = 1400;
  const KLEVB_APP_RESUME_BURST_DELAYS = [350, 1600, 4200];
  const KLEVB_APP_BOOT_RESUME_GRACE_MS = 2500;

  function createAppResumeManager(deps = {}) {
    let klevbyAppResumeTimer = null;
    let klevbyAppResumeInProgress = false;
    let klevbyLastAppResumeAt = 0;
    let klevbyAppHiddenAt = 0;
    let klevbyAppBootCompleted = false;
    let klevbyAppBootCompletedAt = 0;

    function getKlevbyResumeDebug() {
      if (!window.KlevbyResumeDebug) {
        const events = [];
        const counters = new Map();

        window.KlevbyResumeDebug = {
          mark(source, reason, detail = {}) {
            const cleanSource = String(source || "unknown");
            const cleanReason = String(reason || "unknown");
            const key = cleanSource + "::" + cleanReason;
            const count = (counters.get(key) || 0) + 1;
            counters.set(key, count);
            const entry = {
              ts: Date.now(),
              iso: new Date().toISOString(),
              source: cleanSource,
              reason: cleanReason,
              count,
              detail: detail && typeof detail === "object" ? { ...detail } : { value: detail }
            };
            events.push(entry);
            if (events.length > 400) events.shift();
            console.debug("[KlevbyResumeDebug]", entry);
            return entry;
          },
          getEvents() {
            return events.slice();
          },
          reset() {
            events.length = 0;
            counters.clear();
          },
          summary() {
            const bySource = {};
            const byReason = {};
            events.forEach((event) => {
              bySource[event.source] = (bySource[event.source] || 0) + 1;
              byReason[event.reason] = (byReason[event.reason] || 0) + 1;
            });
            return {
              total: events.length,
              bySource,
              byReason,
              last: events.slice(-20)
            };
          }
        };
      }

      return window.KlevbyResumeDebug;
    }

    function markKlevbyResumeDebug(source, reason, detail = {}) {
      try {
        return getKlevbyResumeDebug().mark(source, reason, detail);
      } catch (error) {
        console.debug("Klevby resume debug mark failed", error);
        return null;
      }
    }

    function isKlevbyAppBootResumeAllowed(reason = "resume") {
      const cleanReason = String(reason || "resume");

      if (cleanReason === "online") {
        return true;
      }

      if (!klevbyAppBootCompleted) {
        return false;
      }

      if (
        klevbyAppBootCompletedAt &&
        Date.now() - klevbyAppBootCompletedAt < KLEVB_APP_BOOT_RESUME_GRACE_MS
      ) {
        return false;
      }

      return true;
    }

    function scheduleKlevbyAppResume(reason = "resume", options = {}) {
      markKlevbyResumeDebug("app.schedule", reason, { phase: "schedule", options: { ...options } });
      if (!isKlevbyAppBootResumeAllowed(reason)) {
        markKlevbyResumeDebug("app.schedule", reason, { phase: "blocked_boot_guard" });
        return false;
      }

      clearTimeout(klevbyAppResumeTimer);

      klevbyAppResumeTimer = setTimeout(() => {
        markKlevbyResumeDebug("app.schedule", reason, { phase: "timer_fired" });
        handleKlevbyAppResume(reason, options);
      }, KLEVB_APP_RESUME_DEBOUNCE_MS);

      return true;
    }

    async function handleKlevbyAppResume(reason = "resume", options = {}) {
      const force = Boolean(options.force);
      const now = Date.now();

      if (klevbyAppResumeInProgress) {
        markKlevbyResumeDebug("app.handle", reason, { phase: "skip_in_progress" });
        return false;
      }

      if (!force && now - klevbyLastAppResumeAt < KLEVB_APP_RESUME_MIN_INTERVAL_MS) {
        markKlevbyResumeDebug("app.handle", reason, { phase: "skip_throttle", sinceLastMs: now - klevbyLastAppResumeAt });
        return false;
      }

      klevbyAppResumeInProgress = true;
      klevbyLastAppResumeAt = now;

      const sleptFor = klevbyAppHiddenAt ? now - klevbyAppHiddenAt : 0;
      markKlevbyResumeDebug("app.handle", reason, { phase: "start", force, sleptFor });

      try {
        deps.syncGlobalAuthState?.({ notify: true, forceNotify: true });

        if (typeof window.restoreAuthState === "function") {
          try {
            await window.restoreAuthState("app_resume_" + reason, false);
          } catch (error) {
            console.warn("Klevby: вход не восстановился после возврата:", reason, error);
          }
        }

        markKlevbyResumeDebug("app.dispatch", reason, { phase: "before_dispatch", sleptFor });
        window.dispatchEvent(new CustomEvent("klevby-app-resumed", {
          detail: {
            reason,
            sleptFor,
            user: deps.getCurrentUser?.() ?? null,
            supabase: deps.getSupabaseClient?.() ?? null,
            source: "app"
          }
        }));

        markKlevbyResumeDebug("app.handle", reason, { phase: "refresh_current_screen", sleptFor });
        refreshCurrentScreenAfterResume(reason, { force: true, sleptFor });

        scheduleKlevbyResumeBurst(reason, sleptFor);
        markKlevbyResumeDebug("app.handle", reason, { phase: "done", sleptFor });

        return true;
      } catch (error) {
        markKlevbyResumeDebug("app.handle", reason, { phase: "error", message: String(error?.message || error) });
        console.warn("Klevby: ошибка пробуждения приложения:", reason, error);
        return false;
      } finally {
        klevbyAppResumeInProgress = false;
      }
    }

    function scheduleKlevbyResumeBurst(reason = "resume", sleptFor = 0) {
      KLEVB_APP_RESUME_BURST_DELAYS.forEach((delay, index) => {
        setTimeout(() => {
          if (document.visibilityState === "hidden") return;

          const burstReason = reason + "_burst_" + (index + 1);
          markKlevbyResumeDebug("app.burst", burstReason, { phase: "burst_fire", delay });
          refreshCurrentScreenAfterResume(burstReason, {
            burst: true,
            sleptFor
          });
        }, delay);
      });
    }

    function refreshCurrentScreenAfterResume(reason = "resume", options = {}) {
      const visibleSection = deps.getVisibleSectionName?.();
      const isBurst = Boolean(options.burst);
      markKlevbyResumeDebug("app.refresh", reason, { visibleSection, isBurst });

      try {
        if (visibleSection === "home" || visibleSection === "profile") {
          const wakeFeedFn =
            (typeof window.klevbyWakeFeed === "function" && window.klevbyWakeFeed) ||
            (typeof window.refreshKlevbyFeedSilently === "function" && window.refreshKlevbyFeedSilently) ||
            null;

          if (typeof wakeFeedFn === "function") {
            const delay = isBurst ? 0 : 250;
            setTimeout(() => {
              try { wakeFeedFn(); } catch (error) { console.warn("Klevby: лента не обновилась после resume:", reason, error); }
            }, delay);
          } else if (typeof window.renderProfileFeed === "function") {
            const delay = isBurst ? 0 : 250;
            setTimeout(() => {
              try { window.renderProfileFeed(); } catch (error) { console.warn("Klevby: лента не обновилась после resume:", reason, error); }
            }, delay);
          }

          if (!isBurst && typeof window.syncLocalProfilePhotosToSupabaseFeed === "function") {
            setTimeout(() => {
              try { window.syncLocalProfilePhotosToSupabaseFeed(true); } catch (error) { console.warn("Klevby: синхронизация фото не запустилась после resume:", reason, error); }
            }, 900);
          }
        }

        if (visibleSection === "trips") {
          if (typeof window.loadPosts === "function") window.loadPosts({ force: true });
          else if (typeof window.renderPosts === "function") window.renderPosts();
        }

        if (visibleSection === "market" && typeof window.klevbyLoadMarket === "function") window.klevbyLoadMarket();
        if (visibleSection === "ponds") deps.reloadPondsIfReady?.({ force: true, delay: 250 });
        if (visibleSection === "map" && typeof window.klevbyReloadMap === "function") window.klevbyReloadMap();

      } catch (error) {
        console.warn("Klevby: текущий экран не обновился после возврата:", error);
      }
    }

    function setupKlevbyAppLifecycle() {
      if (window.__klevbyAppLifecycleBound) return;
      window.__klevbyAppLifecycleBound = true;

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          klevbyAppHiddenAt = Date.now();
          return;
        }
        scheduleKlevbyAppResume("visibilitychange", { force: true });
      });

      window.addEventListener("pageshow", () => scheduleKlevbyAppResume("pageshow", { force: true }));
      window.addEventListener("focus", () => scheduleKlevbyAppResume("focus", { force: false }));
      window.addEventListener("online", () => scheduleKlevbyAppResume("online", { force: true }));
    }

    function markBootCompleted() {
      klevbyAppBootCompleted = true;
      klevbyAppBootCompletedAt = Date.now();
    }

    return {
      markKlevbyResumeDebug,
      scheduleKlevbyAppResume,
      handleKlevbyAppResume,
      refreshCurrentScreenAfterResume,
      setupKlevbyAppLifecycle,
      markBootCompleted
    };
  }

  window.KlevbyAppResumeManager = { create: createAppResumeManager };
})(window);
