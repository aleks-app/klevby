(function () {
  const ADMIN_EMAIL = "al822alex@gmail.com";
  const TABLE_NAME = "ponds";

  let ponds = [];
  let editingPondId = null;
  let initialized = false;

  let pondsLoadPromise = null;
  let pondsLoadTimer = null;
  let lastPondsLoadAt = 0;

  const PONDS_LOAD_THROTTLE_MS = 1800;
  const PONDS_RETRY_DELAY_MS = 1200;

  function getSupabase() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getCurrentUser() {
    return (
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  function isAdmin() {
    const user = getCurrentUser();
    return Boolean(user && String(user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function isAuthLockError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("lock") &&
      message.includes("auth-token")
    );
  }

  function setStatus(message, isError) {
    const status = $("pondsStatus");
    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#ffd2d2" : "";
  }

  function setFormMessage(message, isError) {
    const el = $("pondFormMessage");
    if (!el) return;

    el.textContent = message || "";
    el.style.color = isError ? "#ffd2d2" : "";
  }

  function showAdminPanel() {
    const panel = $("pondsAdminPanel");
    if (!panel) return;

    panel.classList.toggle("hidden", !isAdmin());
  }

  function getFallbackImage() {
    return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";
  }

  function pondCardHtml(pond) {
    const canManage = isAdmin();
    const image = pond.photo_url || pond.photo || pond.image_url || getFallbackImage();
    const title = pond.name || "Платный пруд";
    const city = pond.city || pond.region || "";
    const price = pond.price || "";
    const fish = pond.fish || pond.fish_types || "";
    const contacts = pond.contacts || pond.contact || "";
    const description = pond.description || "";
    const lat = pond.lat || pond.latitude || "";
    const lng = pond.lng || pond.longitude || "";
    const hasCoords = lat && lng;

    const mapButton = hasCoords
      ? `<button class="ponds-btn ponds-btn-muted" type="button" onclick="window.open('https://www.google.com/maps?q=${encodeURIComponent(lat + "," + lng)}','_blank')">Открыть карту</button>`
      : "";

    const adminButtons = canManage
      ? `
        <button class="ponds-btn ponds-btn-muted" type="button" onclick="window.klevbyEditPond('${escapeHtml(pond.id)}')">Редактировать</button>
        <button class="ponds-btn ponds-btn-danger" type="button" onclick="window.klevbyDeletePond('${escapeHtml(pond.id)}')">Удалить</button>
      `
      : "";

    return `
      <article class="ponds-card">
        <div class="ponds-card-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45)), url('${escapeHtml(image)}');"></div>

        <div class="ponds-card-body">
          <div class="ponds-card-top">
            <div>
              <h3>${escapeHtml(title)}</h3>
              ${city ? `<p class="ponds-card-city">📍 ${escapeHtml(city)}</p>` : ""}
            </div>

            ${price ? `<div class="ponds-card-price">${escapeHtml(price)}</div>` : ""}
          </div>

          <div class="ponds-tags">
            ${fish ? `<span>${escapeHtml(fish)}</span>` : ""}
            ${contacts ? `<span>☎ ${escapeHtml(contacts)}</span>` : ""}
            ${hasCoords ? `<span>🗺️ Координаты</span>` : ""}
          </div>

          ${description ? `<p class="ponds-card-description">${escapeHtml(description)}</p>` : ""}

          <div class="ponds-card-actions">
            ${mapButton}
            ${adminButtons}
          </div>
        </div>
      </article>
    `;
  }

  function renderPonds() {
    const grid = $("pondsGrid");
    const searchInput = $("pondsSearchInput");

    if (!grid) return;

    const search = normalize(searchInput ? searchInput.value : "");

    let filtered = ponds.slice();

    if (!isAdmin()) {
      filtered = filtered.filter((pond) => pond.is_active !== false);
    }

    if (search) {
      filtered = filtered.filter((pond) => {
        return (
          normalize(pond.name).includes(search) ||
          normalize(pond.city).includes(search) ||
          normalize(pond.region).includes(search) ||
          normalize(pond.price).includes(search) ||
          normalize(pond.fish).includes(search) ||
          normalize(pond.fish_types).includes(search) ||
          normalize(pond.contacts).includes(search) ||
          normalize(pond.description).includes(search)
        );
      });
    }

    showAdminPanel();

    if (!filtered.length) {
      grid.innerHTML = `<div class="ponds-empty">Пока платных прудов нет.</div>`;
      setStatus(isAdmin() ? "Можно добавить первый платный пруд через форму выше." : "Пока водоёмы не добавлены.");
      return;
    }

    grid.innerHTML = filtered.map(pondCardHtml).join("");
    setStatus(`Найдено водоёмов: ${filtered.length}`);
  }

  function scheduleLoadPonds(delay = 500, force = false) {
    clearTimeout(pondsLoadTimer);

    pondsLoadTimer = setTimeout(() => {
      loadPonds({ force }).catch((error) => {
        console.warn("Klevby ponds: отложенная загрузка не удалась:", error);
      });
    }, delay);
  }

  async function loadPonds(options = {}) {
    const force = Boolean(options.force);
    const retry = Number(options.retry || 0);
    const now = Date.now();

    showAdminPanel();

    if (!force && pondsLoadPromise) {
      return pondsLoadPromise;
    }

    if (!force && now - lastPondsLoadAt < PONDS_LOAD_THROTTLE_MS) {
      return pondsLoadPromise || Promise.resolve(ponds);
    }

    pondsLoadPromise = (async function () {
      lastPondsLoadAt = Date.now();

      const supabase = getSupabase();

      if (!supabase) {
        setStatus("Supabase ещё не готов. Пробуем подключиться...", false);
        scheduleLoadPonds(700, true);
        return ponds;
      }

      const grid = $("pondsGrid");

      if (grid && !ponds.length) {
        grid.innerHTML = `
          <div class="ponds-skeleton"></div>
          <div class="ponds-skeleton"></div>
          <div class="ponds-skeleton"></div>
        `;
      }

      setStatus("Загрузка платных прудов...");

      let result;

      try {
        result = await supabase
          .from(TABLE_NAME)
          .select("*")
          .order("created_at", { ascending: false });
      } catch (error) {
        if (isAuthLockError(error) && retry < 2) {
          console.warn("Klevby ponds: Supabase Auth занят, повторяем загрузку:", error);
          setStatus("Подключение занято, повторяем загрузку прудов...", false);
          scheduleLoadPonds(PONDS_RETRY_DELAY_MS, true);
          return ponds;
        }

        console.error("Ошибка загрузки ponds:", error);

        if (grid && !ponds.length) {
          grid.innerHTML = `
            <div class="ponds-empty">
              Не удалось загрузить платные пруды. Проверь таблицу <b>${TABLE_NAME}</b> в Supabase и RLS-права.
            </div>
          `;
        }

        setStatus("Ошибка загрузки платных прудов.", true);
        return ponds;
      }

      const { data, error } = result;

      if (error) {
        if (isAuthLockError(error) && retry < 2) {
          console.warn("Klevby ponds: Supabase Auth занят, повторяем загрузку:", error);
          setStatus("Подключение занято, повторяем загрузку прудов...", false);

          setTimeout(() => {
            loadPonds({ force: true, retry: retry + 1 }).catch((loadError) => {
              console.warn("Klevby ponds: повторная загрузка не удалась:", loadError);
            });
          }, PONDS_RETRY_DELAY_MS);

          return ponds;
        }

        console.error("Ошибка загрузки ponds:", error);

        if (grid && !ponds.length) {
          grid.innerHTML = `
            <div class="ponds-empty">
              Не удалось загрузить платные пруды. Проверь таблицу <b>${TABLE_NAME}</b> в Supabase и RLS-права.
            </div>
          `;
        }

        setStatus("Ошибка загрузки. Скорее всего нет таблицы ponds или закрыт доступ RLS.", true);
        return ponds;
      }

      ponds = data || [];
      renderPonds();

      return ponds;
    })();

    try {
      return await pondsLoadPromise;
    } finally {
      pondsLoadPromise = null;
    }
  }

  function getFormPayload() {
    const latValue = $("pondLatInput") ? $("pondLatInput").value.trim() : "";
    const lngValue = $("pondLngInput") ? $("pondLngInput").value.trim() : "";

    return {
      name: $("pondNameInput").value.trim(),
      city: $("pondCityInput").value.trim(),
      price: $("pondPriceInput").value.trim(),
      fish: $("pondFishInput").value.trim(),
      description: $("pondDescriptionInput").value.trim(),
      photo_url: $("pondPhotoInput").value.trim(),
      lat: latValue ? Number(latValue) : null,
      lng: lngValue ? Number(lngValue) : null,
      contacts: $("pondContactsInput").value.trim(),
      is_active: $("pondActiveInput").checked
    };
  }

  function clearForm() {
    editingPondId = null;

    if ($("pondFormTitle")) $("pondFormTitle").textContent = "Добавить платный пруд";
    if ($("pondCancelEditBtn")) $("pondCancelEditBtn").classList.add("hidden");

    if ($("pondNameInput")) $("pondNameInput").value = "";
    if ($("pondCityInput")) $("pondCityInput").value = "";
    if ($("pondPriceInput")) $("pondPriceInput").value = "";
    if ($("pondFishInput")) $("pondFishInput").value = "";
    if ($("pondDescriptionInput")) $("pondDescriptionInput").value = "";
    if ($("pondPhotoInput")) $("pondPhotoInput").value = "";
    if ($("pondLatInput")) $("pondLatInput").value = "";
    if ($("pondLngInput")) $("pondLngInput").value = "";
    if ($("pondContactsInput")) $("pondContactsInput").value = "";
    if ($("pondActiveInput")) $("pondActiveInput").checked = true;

    setFormMessage("");
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    if (!isAdmin()) {
      setFormMessage("Добавлять пруды может только админ.", true);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setFormMessage("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    const payload = getFormPayload();

    if (!payload.name || !payload.city) {
      setFormMessage("Заполни название и город / область.", true);
      return;
    }

    setFormMessage("Сохраняем...");

    let result;

    if (editingPondId) {
      result = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", editingPondId);
    } else {
      result = await supabase
        .from(TABLE_NAME)
        .insert([payload]);
    }

    if (result.error) {
      console.error("Ошибка сохранения ponds:", result.error);
      setFormMessage("Не получилось сохранить. Проверь таблицу ponds и RLS-права.", true);
      return;
    }

    setFormMessage(editingPondId ? "Пруд обновлён." : "Пруд добавлен.");
    clearForm();
    await loadPonds({ force: true });
  }

  window.klevbyEditPond = function (id) {
    if (!isAdmin()) return;

    const pond = ponds.find((item) => String(item.id) === String(id));
    if (!pond) return;

    editingPondId = id;

    if ($("pondFormTitle")) $("pondFormTitle").textContent = "Редактировать платный пруд";
    if ($("pondCancelEditBtn")) $("pondCancelEditBtn").classList.remove("hidden");

    $("pondNameInput").value = pond.name || "";
    $("pondCityInput").value = pond.city || pond.region || "";
    $("pondPriceInput").value = pond.price || "";
    $("pondFishInput").value = pond.fish || pond.fish_types || "";
    $("pondDescriptionInput").value = pond.description || "";
    $("pondPhotoInput").value = pond.photo_url || pond.photo || pond.image_url || "";
    $("pondLatInput").value = pond.lat || pond.latitude || "";
    $("pondLngInput").value = pond.lng || pond.longitude || "";
    $("pondContactsInput").value = pond.contacts || pond.contact || "";
    $("pondActiveInput").checked = pond.is_active !== false;

    const panel = $("pondsAdminPanel");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  window.klevbyDeletePond = async function (id) {
    if (!isAdmin()) return;

    if (!confirm("Удалить платный пруд?")) return;

    const supabase = getSupabase();
    if (!supabase) {
      alert("Supabase ещё не готов.");
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Ошибка удаления ponds:", error);
      alert("Не получилось удалить. Проверь RLS-права.");
      return;
    }

    await loadPonds({ force: true });
  };

  function bindEvents() {
    const form = $("pondForm");
    const search = $("pondsSearchInput");
    const cancel = $("pondCancelEditBtn");

    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", handleFormSubmit);
    }

    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      search.addEventListener("input", renderPonds);
    }

    if (cancel && !cancel.dataset.bound) {
      cancel.dataset.bound = "true";
      cancel.addEventListener("click", clearForm);
    }
  }

  function initPonds() {
    bindEvents();
    showAdminPanel();

    if (initialized) {
      scheduleLoadPonds(500, false);
      return;
    }

    initialized = true;
    scheduleLoadPonds(650, false);
  }

  window.klevbyLoadPonds = function () {
    return loadPonds({ force: true });
  };

  window.klevbyInitPonds = initPonds;
  window.loadPonds = window.klevbyLoadPonds;

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    showAdminPanel();
    scheduleLoadPonds(900, false);
  });

  window.addEventListener("klevby-auth-changed", function () {
    bindEvents();
    showAdminPanel();
    scheduleLoadPonds(900, true);
  });
})();
