(function () {
  "use strict";

  const MODULE_FILES = [
    "modal-core.js",
    "modal-styles.js",
    "photo-viewer.js",
    "comments-modal.js",
    "comments-actions.js"
  ];

  let klevbyFeedModalModulesPromise = null;
  let klevbyFeedModalModulesReady = false;

  const bridgeScriptSrc = getBridgeScriptSrc();

  function getBridgeScriptSrc() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }

    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const current = scripts
      .slice()
      .reverse()
      .find((script) => String(script.src || "").includes("/assets/js/feed/feed-modals.js"));

    return current ? current.src : "";
  }

  function getCacheVersion() {
    try {
      const bridgeUrl = bridgeScriptSrc ? new URL(bridgeScriptSrc, window.location.href) : null;
      const pageUrl = new URL(window.location.href);

      return (
        bridgeUrl?.searchParams?.get("v") ||
        bridgeUrl?.searchParams?.get("update") ||
        pageUrl.searchParams.get("v") ||
        pageUrl.searchParams.get("update") ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function getModuleUrl(fileName) {
    try {
      const baseUrl = bridgeScriptSrc
        ? new URL("modals/" + fileName, bridgeScriptSrc)
        : new URL("/assets/js/feed/modals/" + fileName, window.location.origin);

      const version = getCacheVersion();

      if (version) {
        baseUrl.searchParams.set("v", version);
      }

      return baseUrl.href;
    } catch (_) {
      const version = getCacheVersion();
      const query = version ? `?v=${encodeURIComponent(version)}` : "";

      return `/assets/js/feed/modals/${fileName}${query}`;
    }
  }

  function findExistingModuleScript(fileName) {
    const scripts = Array.from(document.querySelectorAll("script[src]"));

    return scripts.find((script) => {
      const src = String(script.src || "");
      return src.includes("/assets/js/feed/modals/" + fileName) || src.includes("/modals/" + fileName);
    });
  }

  function loadModuleScript(fileName) {
    return new Promise((resolve, reject) => {
      const loadedKey = "__klevbyFeedModalModuleLoaded_" + fileName.replace(/[^a-zA-Z0-9_]/g, "_");

      if (window[loadedKey]) {
        resolve(true);
        return;
      }

      const existing = findExistingModuleScript(fileName);

      if (existing) {
        window[loadedKey] = true;
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = getModuleUrl(fileName);
      script.async = false;
      script.defer = false;
      script.dataset.klevbyFeedModalModule = fileName;

      script.onload = () => {
        window[loadedKey] = true;
        resolve(true);
      };

      script.onerror = () => {
        reject(new Error("Не загрузился модуль ленты: " + fileName));
      };

      document.head.appendChild(script);
    });
  }

  function loadModalModules() {
    if (klevbyFeedModalModulesPromise) {
      return klevbyFeedModalModulesPromise;
    }

    klevbyFeedModalModulesPromise = MODULE_FILES
      .reduce((chain, fileName) => {
        return chain.then(() => loadModuleScript(fileName));
      }, Promise.resolve())
      .then(() => {
        klevbyFeedModalModulesReady = true;
        exposeLegacyGlobals();

        window.dispatchEvent(new CustomEvent("klevby-feed-modals-ready", {
          detail: {
            version: "20260509-feed-modals-bridge-1",
            files: MODULE_FILES.slice()
          }
        }));

        return true;
      })
      .catch((error) => {
        klevbyFeedModalModulesReady = false;
        console.warn("Klevby feed modals bridge: модули не загрузились", error);
        throw error;
      });

    return klevbyFeedModalModulesPromise;
  }

  function getFirstModule(names) {
    for (const name of names) {
      const module = window[name];

      if (module && typeof module === "object") {
        return module;
      }
    }

    return {};
  }

  function getCoreModule() {
    return getFirstModule([
      "KlevbyFeedModalCore",
      "KlevbyFeedModalsCore",
      "KlevbyFeedCoreModal"
    ]);
  }

  function getStylesModule() {
    return getFirstModule([
      "KlevbyFeedModalStyles",
      "KlevbyFeedModalsStyles",
      "KlevbyFeedStylesModal"
    ]);
  }

  function getPhotoViewerModule() {
    return getFirstModule([
      "KlevbyFeedPhotoViewer",
      "KlevbyFeedViewerPhoto",
      "KlevbyFeedModalsPhotoViewer",
      "KlevbyFeedPhotoModal"
    ]);
  }

  function getCommentsModalModule() {
    return getFirstModule([
      "KlevbyFeedCommentsModal",
      "KlevbyFeedCommentModal",
      "KlevbyFeedModalsComments",
      "KlevbyFeedModalComments"
    ]);
  }

  function getCommentsActionsModule() {
    return getFirstModule([
      "KlevbyFeedCommentsActions",
      "KlevbyFeedCommentActions",
      "KlevbyFeedModalsCommentsActions",
      "KlevbyFeedModalCommentsActions"
    ]);
  }

  function callAfterReady(moduleGetter, methodName, args = [], fallback = null) {
    const currentModule = moduleGetter();

    if (currentModule && typeof currentModule[methodName] === "function") {
      return currentModule[methodName].apply(currentModule, args);
    }

    return loadModalModules()
      .then(() => {
        const module = moduleGetter();

        if (module && typeof module[methodName] === "function") {
          return module[methodName].apply(module, args);
        }

        if (typeof fallback === "function") {
          return fallback();
        }

        return undefined;
      })
      .catch((error) => {
        console.warn("Klevby feed modals bridge: функция недоступна", {
          methodName,
          error: String(error?.message || error)
        });

        if (typeof fallback === "function") {
          return fallback();
        }

        return undefined;
      });
  }

  function ensureModalStyles() {
    return callAfterReady(getStylesModule, "ensureModalStyles");
  }

  function ensurePhotoViewer() {
    return callAfterReady(getPhotoViewerModule, "ensurePhotoViewer");
  }

  function openProfilePhotoFeedItem(postId) {
    return callAfterReady(getPhotoViewerModule, "openProfilePhotoFeedItem", [postId], () => {
      if (typeof window.openProfilePhotoViewer === "function") {
        return window.openProfilePhotoViewer(postId);
      }

      if (typeof window.openKlevbyProfile === "function") {
        return window.openKlevbyProfile();
      }

      if (typeof window.showSection === "function") {
        return window.showSection("profile");
      }

      return undefined;
    });
  }

  function openFeedPhotoViewer(item) {
    return callAfterReady(getPhotoViewerModule, "openFeedPhotoViewer", [item]);
  }

  function closeFeedPhotoViewer() {
    return callAfterReady(getPhotoViewerModule, "closeFeedPhotoViewer", [], () => {
      const viewer = document.getElementById("klevbyFeedPhotoViewer");
      const image = document.getElementById("klevbyFeedPhotoViewerImage");

      if (viewer) {
        viewer.classList.add("hidden");
      }

      if (image) {
        image.removeAttribute("src");
      }

      document.body.classList.remove("post-modal-open");
      return undefined;
    });
  }

  function deleteFeedItem(item) {
    return callAfterReady(getPhotoViewerModule, "deleteFeedItem", [item]);
  }

  function ensureCommentModal() {
    return callAfterReady(getCommentsModalModule, "ensureCommentModal");
  }

  function openFeedCommentModal(postId) {
    return callAfterReady(getCommentsModalModule, "openFeedCommentModal", [postId], () => {
      alert("Комментарии ещё загружаются. Попробуй ещё раз через секунду.");
      return undefined;
    });
  }

  function closeFeedCommentModal() {
    return callAfterReady(getCommentsModalModule, "closeFeedCommentModal", [], () => {
      const modal = document.getElementById("klevbyFeedCommentModal");

      if (modal) {
        modal.classList.add("hidden");
        modal.dataset.postId = "";
      }

      document.body.classList.remove("post-modal-open");
      return undefined;
    });
  }

  function loadCommentsIntoModal(postId) {
    return callAfterReady(getCommentsModalModule, "loadCommentsIntoModal", [postId]);
  }

  function submitFeedComment() {
    const actionsModule = getCommentsActionsModule();

    if (actionsModule && typeof actionsModule.submitFeedComment === "function") {
      return actionsModule.submitFeedComment();
    }

    const commentsModule = getCommentsModalModule();

    if (commentsModule && typeof commentsModule.submitFeedComment === "function") {
      return commentsModule.submitFeedComment();
    }

    return loadModalModules()
      .then(() => {
        const freshActionsModule = getCommentsActionsModule();

        if (freshActionsModule && typeof freshActionsModule.submitFeedComment === "function") {
          return freshActionsModule.submitFeedComment();
        }

        const freshCommentsModule = getCommentsModalModule();

        if (freshCommentsModule && typeof freshCommentsModule.submitFeedComment === "function") {
          return freshCommentsModule.submitFeedComment();
        }

        alert("Отправка комментариев ещё не подключена.");
        return undefined;
      })
      .catch((error) => {
        console.warn("Klevby feed modals bridge: submitFeedComment недоступен", error);
        alert("Не удалось загрузить отправку комментариев.");
        return undefined;
      });
  }

  function deleteFeedComment(commentId) {
    const actionsModule = getCommentsActionsModule();

    if (actionsModule && typeof actionsModule.deleteFeedComment === "function") {
      return actionsModule.deleteFeedComment(commentId);
    }

    const commentsModule = getCommentsModalModule();

    if (commentsModule && typeof commentsModule.deleteFeedComment === "function") {
      return commentsModule.deleteFeedComment(commentId);
    }

    return loadModalModules()
      .then(() => {
        const freshActionsModule = getCommentsActionsModule();

        if (freshActionsModule && typeof freshActionsModule.deleteFeedComment === "function") {
          return freshActionsModule.deleteFeedComment(commentId);
        }

        const freshCommentsModule = getCommentsModalModule();

        if (freshCommentsModule && typeof freshCommentsModule.deleteFeedComment === "function") {
          return freshCommentsModule.deleteFeedComment(commentId);
        }

        alert("Удаление комментариев ещё не подключено.");
        return undefined;
      })
      .catch((error) => {
        console.warn("Klevby feed modals bridge: deleteFeedComment недоступен", error);
        alert("Не удалось загрузить удаление комментариев.");
        return undefined;
      });
  }

  function runAddComment(postId, text) {
    return callAfterReady(getCommentsActionsModule, "runAddComment", [postId, text]);
  }

  function toggleLikeFromViewer(postId) {
    return callAfterReady(getPhotoViewerModule, "toggleLikeFromViewer", [postId]);
  }

  function bindPressFeedback(root) {
    const core = getCoreModule();

    if (core && typeof core.bindPressFeedback === "function") {
      return core.bindPressFeedback(root);
    }

    return loadModalModules().then(() => {
      const freshCore = getCoreModule();

      if (freshCore && typeof freshCore.bindPressFeedback === "function") {
        return freshCore.bindPressFeedback(root);
      }

      return undefined;
    });
  }

  function setModalBodyLock() {
    const core = getCoreModule();

    if (core && typeof core.setModalBodyLock === "function") {
      return core.setModalBodyLock();
    }

    document.body.classList.add("post-modal-open");
    return undefined;
  }

  function releaseModalBodyLockIfPossible() {
    const core = getCoreModule();

    if (core && typeof core.releaseModalBodyLockIfPossible === "function") {
      return core.releaseModalBodyLockIfPossible();
    }

    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const comments = document.getElementById("klevbyFeedCommentModal");

    const viewerOpen = viewer && !viewer.classList.contains("hidden");
    const commentsOpen = comments && !comments.classList.contains("hidden");

    if (!viewerOpen && !commentsOpen) {
      document.body.classList.remove("post-modal-open");
    }

    return undefined;
  }

  function getCachedItem(postId) {
    const core = getCoreModule();

    if (core && typeof core.getCachedItem === "function") {
      return core.getCachedItem(postId);
    }

    const state = window.KlevbyFeedState || {};
    const cleanId = String(postId || "");

    if (typeof state.getCachedItem === "function") {
      return state.getCachedItem(cleanId);
    }

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function exposeLegacyGlobals() {
    const modals = {
      loadModalModules,
      isReady: function isReady() {
        return Boolean(klevbyFeedModalModulesReady);
      },

      ensureModalStyles,
      ensurePhotoViewer,
      openProfilePhotoFeedItem,
      openFeedPhotoViewer,
      closeFeedPhotoViewer,
      deleteFeedItem,

      ensureCommentModal,
      openFeedCommentModal,
      closeFeedCommentModal,
      loadCommentsIntoModal,
      submitFeedComment,
      deleteFeedComment,
      runAddComment,

      toggleLikeFromViewer,

      bindPressFeedback,
      setModalBodyLock,
      releaseModalBodyLockIfPossible,
      getCachedItem
    };

    window.KlevbyFeedModals = modals;

    window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
    window.closeFeedPhotoViewer = closeFeedPhotoViewer;

    window.openFeedCommentModal = openFeedCommentModal;
    window.closeFeedCommentModal = closeFeedCommentModal;
    window.submitFeedComment = submitFeedComment;
    window.deleteFeedComment = deleteFeedComment;

    return modals;
  }

  function initFeedModalsBridge() {
    exposeLegacyGlobals();

    loadModalModules()
      .then(() => {
        ensureModalStyles();
        exposeLegacyGlobals();

        console.log("Klevby feed modals bridge loaded");
      })
      .catch((error) => {
        console.warn("Klevby feed modals bridge: старт с ошибкой", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedModalsBridge);
  } else {
    setTimeout(initFeedModalsBridge, 0);
  }

  exposeLegacyGlobals();
})();
