(function () {
  const POSTS_RENDER_VERSION = "20260629-last-known-trips-render-1";

  function escapeHtml(value) {
    if (typeof window.escapeHtml === "function") {
      return window.escapeHtml(value);
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getTripRows(posts) {
    const state = window.KlevbyPostsState;
    if (!state?.partitionTrips) {
      return {
        active: Array.isArray(posts) ? posts : [],
        archive: [],
      };
    }

    const partitions = state.partitionTrips(posts, { ownerId: state.getOwnerId?.() || null });
    return {
      active: [...(partitions.activeAll || []), ...(partitions.undatedAll || [])],
      archive: partitions.expiredAll || [],
    };
  }

  function tripCardHtml(post) {
    const name = escapeHtml(post?.name || "Рыбак");
    const city = escapeHtml(post?.city || "Город не указан");
    const destination = escapeHtml(post?.destination || "Направление не указано");
    const tripTime = escapeHtml(post?.trip_time || "Дата не указана");
    const text = escapeHtml(post?.text || "");

    return `
      <article class="trips-fullscreen-trip-card" data-trip-id="${escapeHtml(post?.id || "")}">
        <h4>${name}</h4>
        <p><strong>Откуда:</strong> ${city}</p>
        <p><strong>Куда:</strong> ${destination}</p>
        <p><strong>Когда:</strong> ${tripTime}</p>
        ${text ? `<p>${text}</p>` : ""}
      </article>
    `;
  }

  function renderShelf(shelf, trips, options = {}) {
    if (!shelf) return;

    const ui = window.KlevbyLastKnownUi;
    const notice =
      options.source === "cache" && options.offline !== false && ui?.savedNoticeHtml
        ? ui.savedNoticeHtml({
            title: "Последние сохранённые выезды",
            subtitle: "Обновятся, когда появится интернет",
            compact: true,
          })
        : "";

    if (!trips.length) {
      if (options.source === "cache" && options.offline) {
        shelf.innerHTML = notice + (ui?.tripsOfflineEmptyHtml?.() || "");
        return;
      }

      shelf.innerHTML = notice + `<div class="info-line">Пока нет выездов в этом разделе.</div>`;
      return;
    }

    shelf.innerHTML = notice + trips.map(tripCardHtml).join("");
  }

  function updateCounts(activeCount, archiveCount) {
    const countEl = document.querySelector("#tripsSection .trips-fullscreen-list-count");
    if (countEl) {
      countEl.textContent = String(activeCount);
    }

    window.KlevbyTripsListOwner?.setTrips?.(
      window.KlevbyPostsState?.getPostsArray?.() || [],
    );
    window.KlevbyTripsState?.setCounts?.({
      activeCount,
      archiveCount,
    });
  }

  function renderPosts(options = {}) {
    const posts = window.KlevbyPostsState?.getPostsArray?.() || [];
    const rows = getTripRows(posts);
    const activeShelf = document.getElementById("tripsFullscreenActiveShelf");
    const archiveShelf = document.getElementById("tripsFullscreenArchiveShelf");
    const degraded = window.KlevbyLastKnownCache?.isNetworkDegraded?.() === true;
    const renderOptions = {
      source: options.source || "fresh",
      offline: options.offline ?? degraded,
    };

    window.KlevbyLastKnownUi?.ensureStyle?.();

    if (!posts.length && renderOptions.source !== "cache") {
      if (activeShelf) activeShelf.innerHTML = "";
      if (archiveShelf) archiveShelf.innerHTML = "";
      updateCounts(0, 0);
      return false;
    }

    if (!posts.length && renderOptions.offline) {
      renderShelf(activeShelf, [], renderOptions);
      if (archiveShelf) archiveShelf.innerHTML = "";
      updateCounts(0, 0);
      return true;
    }

    renderShelf(activeShelf, rows.active, renderOptions);
    renderShelf(archiveShelf, rows.archive, {
      ...renderOptions,
      source: rows.archive.length ? renderOptions.source : "fresh",
    });

    updateCounts(rows.active.length, rows.archive.length);
    return true;
  }

  function setMineTripsModeButtons() {
    return false;
  }

  window.KlevbyPostsRender = {
    renderPosts,
    setMineTripsModeButtons,
    version: POSTS_RENDER_VERSION,
  };

  window.renderPosts = renderPosts;
})();
