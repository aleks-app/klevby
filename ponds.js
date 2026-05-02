(function () {
  const ADMIN_EMAIL = "al822alex@gmail.com";
  const TABLE_NAME = "paid_ponds";

  let pondsDb = null;
  let pondsCurrentUser = null;
  let ponds = [];
  let editingPondId = null;
  let initialized = false;

  function waitForMainApp() {
    const timer = setInterval(async () => {
      if (window.klevbySupabaseClient) {
        clearInterval(timer);
        pondsDb = window.klevbySupabaseClient;
        pondsCurrentUser = window.klevbyCurrentUser || null;
        initPondsModule();
      }
    }, 250);
  }

  function initPondsModule() {
    if (initialized) return;
    initialized = true;

    window.klevbyLoadPonds = loadPonds;

    window.addEventListener("klevby-auth-changed", function (event) {
      pondsCurrentUser = event.detail?.user || null;
      renderAdminBlock();
      renderPonds();
    });

    document.addEventListener("click", handlePondsClick);
    document.addEventListener("submit", handlePondFormSubmit);

    loadPonds();
  }

  function isAdmin() {
    return pondsCurrentUser && pondsCurrentUser.email === ADMIN_EMAIL;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function parseFishTypes(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatFishTypes(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(", ");
    }

    return String(value || "");
  }

  function normalizePond(row) {
    return {
      id: row.id,
      title: row.title || row.name || "",
      city: row.city || "",
      description: row.description || "",
      price: row.price || "",
      fish_types: Array.isArray(row.fish_types) ? row.fish_types : [],
      contacts: row.contacts || "",
      photo_url: row.photo_url || "",
      lat: row.lat ?? "",
      lng: row.lng ?? "",
      is_active: Boolean(row.is_active),
      created_at: row.created_at || ""
    };
  }

  function getRoot() {
    return document.getElementById("paidPondsRoot");
  }

  function getAdminRoot() {
    return document.getElementById("paidPondsAdminRoot");
  }

  function getStatusRoot() {
    return document.getElementById("paidPondsStatus");
  }

  function setStatus(message, isError = false) {
    const status = getStatusRoot();
    if (!status) return;

    status.textContent = message || "";
    status.classList.toggle("ponds-status-error", Boolean(isError));
    status.classList.toggle("hidden", !message);
  }

  async function loadPonds() {
    if (!pondsDb) return;

    const root = getRoot();
    if (root) {
      root.innerHTML = `
        <div class="ponds-loading-card">
          <div class="ponds-loader"></div>
          <div>Загрузка платных прудов...</div>
        </div>
      `;
    }

    renderAdminBlock();

    const { data, error } = await pondsDb
      .from(TABLE_NAME)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки платных прудов:", error);
      if (root) {
        root.innerHTML = `
          <div class="ponds-empty">
            Не удалось загрузить платные пруды. Проверь таблицу paid_ponds и RLS.
          </div>
        `;
      }
      return;
    }

    ponds = (data || []).map(normalizePond);
    renderPonds();
  }

  function renderAdminBlock() {
    const adminRoot = getAdminRoot();
    if (!adminRoot) return;

    if (!isAdmin()) {
      adminRoot.innerHTML = "";
      return;
    }

    adminRoot.innerHTML = `
      <div class="ponds-admin-panel">
        <div class="ponds-admin-head">
          <div>
            <div class="ponds-admin-kicker">Админ-панель</div>
            <h3>Добавить платный пруд</h3>
          </div>
          <button class="ponds-admin-reset" type="button" data-pond-action="reset-form">
            Очистить
          </button>
        </div>

        <form id="paidPondForm" class="ponds-form">
          <input type="hidden" id="pondIdInput" />

          <fieldset class="ponds-fieldset">
            <legend>Основная информация</legend>

            <div class="ponds-form-grid">
              <label>
                <span>Название</span>
                <input id="pondTitleInput" type="text" placeholder="Например: Пруд Рыбное место" required />
              </label>

              <label>
                <span>Город / район</span>
                <input id="pondCityInput" type="text" placeholder="Минск, Дзержинск, Брест..." required />
              </label>

              <label>
                <span>Цена</span>
                <input id="pondPriceInput" type="text" placeholder="Например: 25 BYN / день" required />
              </label>

              <label>
                <span>Виды рыб</span>
                <input id="pondFishInput" type="text" placeholder="Карп, карась, амур, щука" />
              </label>
            </div>

            <label class="ponds-full">
              <span>Описание</span>
              <textarea id="pondDescriptionInput" placeholder="Условия рыбалки, беседки, запуск рыбы, правила..." required></textarea>
            </label>
          </fieldset>

          <fieldset class="ponds-fieldset">
            <legend>Медиа и Гео</legend>

            <div class="ponds-form-grid">
              <label>
                <span>Фото URL</span>
                <input id="pondPhotoInput" type="url" placeholder="https://..." />
              </label>

              <label>
                <span>Широта LAT</span>
                <input id="pondLatInput" type="number" step="any" placeholder="53.9006" />
              </label>

              <label>
                <span>Долгота LNG</span>
                <input id="pondLngInput" type="number" step="any" placeholder="27.5590" />
              </label>

              <label class="ponds-toggle-label">
                <span>Статус</span>
                <select id="pondStatusInput">
                  <option value="true">Активен</option>
                  <option value="false">Скрыт</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset class="ponds-fieldset">
            <legend>Контакты</legend>

            <div class="ponds-form-grid">
              <label class="ponds-full">
                <span>Контакты владельца</span>
                <input id="pondContactsInput" type="text" placeholder="Телефон, Telegram, сайт или Instagram" />
              </label>
            </div>
          </fieldset>

          <div class="ponds-form-actions">
            <button class="ponds-save-btn" type="submit" id="pondSaveBtn">
              Сохранить пруд
            </button>
            <button class="ponds-cancel-btn hidden" type="button" id="pondCancelEditBtn" data-pond-action="reset-form">
              Отмена редактирования
            </button>
          </div>

          <div id="paidPondsStatus" class="ponds-status hidden"></div>
        </form>
      </div>
    `;
  }

  function renderPonds() {
    const root = getRoot();
    if (!root) return;

    if (!ponds.length) {
      root.innerHTML = `
        <div class="ponds-empty">
          <div class="ponds-empty-icon">🌊</div>
          <h3>Платные пруды скоро появятся</h3>
          <p>Админ может добавить первый водоём через форму выше.</p>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="ponds-grid-modern">
        ${ponds.map(pondCardHtml).join("")}
      </div>
    `;
  }

  function pondCardHtml(pond) {
    const fish = Array.isArray(pond.fish_types) ? pond.fish_types : [];
    const image = pond.photo_url || "narach-bg.webp";
    const mapLink =
      pond.lat && pond.lng
        ? `https://www.google.com/maps?q=${encodeURIComponent(pond.lat)},${encodeURIComponent(pond.lng)}`
        : "";

    const adminActions = isAdmin()
      ? `
        <div class="pond-card-admin">
          <button type="button" data-pond-action="edit" data-pond-id="${escapeHtml(pond.id)}">Редактировать</button>
          <button type="button" data-pond-action="delete" data-pond-id="${escapeHtml(pond.id)}">Удалить</button>
        </div>
      `
      : "";

    return `
      <article class="pond-card">
        <div class="pond-card-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.68)), url('${escapeHtml(image)}');">
          <div class="pond-card-price">${escapeHtml(pond.price || "Цена по запросу")}</div>
          <div class="pond-card-city">📍 ${escapeHtml(pond.city || "Беларусь")}</div>
        </div>

        <div class="pond-card-body">
          <div class="pond-card-top">
            <h3>${escapeHtml(pond.title || "Платный пруд")}</h3>
            <span class="pond-card-status">Открыт</span>
          </div>

          <p>${escapeHtml(pond.description || "Описание скоро появится.")}</p>

          <div class="pond-card-fish">
            ${
              fish.length
                ? fish.map(item => `<span>${escapeHtml(item)}</span>`).join("")
                : `<span>Рыба уточняется</span>`
            }
          </div>

          <div class="pond-card-info">
            ${pond.contacts ? `<div>☎️ ${escapeHtml(pond.contacts)}</div>` : ""}
            ${pond.lat && pond.lng ? `<div>🧭 ${escapeHtml(pond.lat)}, ${escapeHtml(pond.lng)}</div>` : ""}
          </div>

          <div class="pond-card-actions">
            ${
              mapLink
                ? `<a href="${mapLink}" target="_blank" rel="noopener">Открыть карту</a>`
                : `<button type="button" disabled>Карта не указана</button>`
            }
          </div>

          ${adminActions}
        </div>
      </article>
    `;
  }

  function getFormPayload() {
    const title = cleanText(document.getElementById("pondTitleInput")?.value);
    const city = cleanText(document.getElementById("pondCityInput")?.value);
    const description = cleanText(document.getElementById("pondDescriptionInput")?.value);
    const price = cleanText(document.getElementById("pondPriceInput")?.value);
    const fishTypes = parseFishTypes(document.getElementById("pondFishInput")?.value);
    const contacts = cleanText(document.getElementById("pondContactsInput")?.value);
    const photoUrl = cleanText(document.getElementById("pondPhotoInput")?.value);
    const latRaw = cleanText(document.getElementById("pondLatInput")?.value);
    const lngRaw = cleanText(document.getElementById("pondLngInput")?.value);
    const isActive = document.getElementById("pondStatusInput")?.value === "true";

    if (!title || !city || !description || !price) {
      throw new Error("Заполни название, город, описание и цену.");
    }

    return {
      title,
      city,
      description,
      price,
      fish_types: fishTypes,
      contacts,
      photo_url: photoUrl,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
      is_active: isActive
    };
  }

  async function handlePondFormSubmit(event) {
    if (event.target?.id !== "paidPondForm") return;

    event.preventDefault();

    if (!isAdmin()) {
      alert("Добавлять платные пруды может только админ.");
      return;
    }

    const saveBtn = document.getElementById("pondSaveBtn");

    try {
      setStatus("");
      if (saveBtn) saveBtn.disabled = true;

      const payload = getFormPayload();

      let result;

      if (editingPondId) {
        result = await pondsDb
          .from(TABLE_NAME)
          .update(payload)
          .eq("id", editingPondId);
      } else {
        result = await pondsDb
          .from(TABLE_NAME)
          .insert([payload]);
      }

      if (result.error) {
        throw result.error;
      }

      resetForm();
      setStatus(editingPondId ? "Пруд обновлён." : "Пруд добавлен.");
      await loadPonds();
    } catch (error) {
      console.error("Ошибка сохранения пруда:", error);
      setStatus(error.message || "Не получилось сохранить пруд.", true);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function handlePondsClick(event) {
    const button = event.target.closest("[data-pond-action]");
    if (!button) return;

    const action = button.dataset.pondAction;
    const id = button.dataset.pondId;

    if (action === "reset-form") {
      resetForm();
      return;
    }

    if (!isAdmin()) {
      alert("Это действие доступно только админу.");
      return;
    }

    if (action === "edit") {
      startEditPond(id);
      return;
    }

    if (action === "delete") {
      await deletePond(id);
    }
  }

  function startEditPond(id) {
    const pond = ponds.find((item) => String(item.id) === String(id));
    if (!pond) return;

    editingPondId = pond.id;

    document.getElementById("pondIdInput").value = pond.id || "";
    document.getElementById("pondTitleInput").value = pond.title || "";
    document.getElementById("pondCityInput").value = pond.city || "";
    document.getElementById("pondDescriptionInput").value = pond.description || "";
    document.getElementById("pondPriceInput").value = pond.price || "";
    document.getElementById("pondFishInput").value = formatFishTypes(pond.fish_types);
    document.getElementById("pondContactsInput").value = pond.contacts || "";
    document.getElementById("pondPhotoInput").value = pond.photo_url || "";
    document.getElementById("pondLatInput").value = pond.lat || "";
    document.getElementById("pondLngInput").value = pond.lng || "";
    document.getElementById("pondStatusInput").value = pond.is_active ? "true" : "false";

    const saveBtn = document.getElementById("pondSaveBtn");
    const cancelBtn = document.getElementById("pondCancelEditBtn");

    if (saveBtn) saveBtn.textContent = "Сохранить изменения";
    if (cancelBtn) cancelBtn.classList.remove("hidden");

    const adminPanel = document.querySelector(".ponds-admin-panel");
    if (adminPanel) {
      adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function deletePond(id) {
    if (!id) return;

    if (!confirm("Удалить платный пруд? Это действие нельзя отменить.")) {
      return;
    }

    const { error } = await pondsDb
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Ошибка удаления пруда:", error);
      alert("Не получилось удалить пруд. Проверь RLS delete для paid_ponds.");
      return;
    }

    ponds = ponds.filter((item) => String(item.id) !== String(id));
    renderPonds();
  }

  function resetForm() {
    editingPondId = null;

    const form = document.getElementById("paidPondForm");
    if (form) form.reset();

    const idInput = document.getElementById("pondIdInput");
    const saveBtn = document.getElementById("pondSaveBtn");
    const cancelBtn = document.getElementById("pondCancelEditBtn");

    if (idInput) idInput.value = "";
    if (saveBtn) saveBtn.textContent = "Сохранить пруд";
    if (cancelBtn) cancelBtn.classList.add("hidden");

    setStatus("");
  }

  waitForMainApp();
})();
