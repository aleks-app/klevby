function getOwnerId() {
  return currentUser ? currentUser.id : null;
}

function cleanTelegram(value) {
  let v = String(value || "").trim();

  v = v.replace(/^@/, "");
  v = v.replace(/^https?:\/\/t\.me\//i, "");
  v = v.replace(/^https?:\/\/telegram\.me\//i, "");
  v = v.replace(/^t\.me\//i, "");
  v = v.split("?")[0];
  v = v.split("/")[0];
  v = v.replace(/[^a-zA-Z0-9_]/g, "");

  return v;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFishingTypeClass(type) {
  const t = normalizeText(type);

  if (t.includes("спин")) return "type-spinning";
  if (t.includes("фидер")) return "type-feeder";
  if (t.includes("поплав")) return "type-float";
  if (t.includes("карп")) return "type-carp";
  if (t.includes("зим")) return "type-winter";

  return "";
}

function getCardImage(post) {
  const key = String(post.id || post.created_at || post.name || Math.random());
  let sum = 0;

  for (let i = 0; i < key.length; i++) {
    sum += key.charCodeAt(i);
  }

  return CARD_IMAGES[sum % CARD_IMAGES.length];
}

function saveAuthorLocal(name, telegram) {
  localStorage.setItem("klevby_author_name", name || "");
  localStorage.setItem("klevby_author_telegram", telegram || "");
}

async function loadPosts() {
  showStatus("Загрузка объявлений...");

  const postsSection = document.getElementById("postsSection");
  if (postsSection) {
    postsSection.innerHTML = `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
  }

  const { data, error } = await supabaseClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showStatus("Не удалось загрузить объявления. Проверь таблицу posts и RLS.", true);

    if (postsSection) {
      postsSection.innerHTML = "";
    }

    return;
  }

  posts = data || [];
  renderPosts();
}

function renderPosts() {
  const list = document.getElementById("postsSection");
  if (!list) return;

  const search = normalizeText(document.getElementById("searchInput")?.value);
  const selectedCity = normalizeText(document.getElementById("citySelect")?.value);
  const selectedType = normalizeText(document.getElementById("typeSelect")?.value);
  const telegramOnly = document.getElementById("telegramOnly")?.checked;
  const ownerId = getOwnerId();

  let filtered = [...posts];

  if (viewMode === "mine") {
    filtered = filtered.filter(post => ownerId && post.owner_id === ownerId);
    showStatus("Сейчас показаны: мои объявления.");
  } else {
    showStatus("Сейчас показаны: все объявления.");
  }

  if (search) {
    filtered = filtered.filter(post =>
      normalizeText(post.name).includes(search) ||
      normalizeText(post.city).includes(search) ||
      normalizeText(post.destination).includes(search) ||
      normalizeText(post.trip_time).includes(search) ||
      normalizeText(post.transport).includes(search) ||
      normalizeText(post.seats).includes(search) ||
      normalizeText(post.text).includes(search) ||
      normalizeText(post.fishing_type).includes(search)
    );
  }

  if (selectedCity) {
    filtered = filtered.filter(post => normalizeText(post.city).includes(selectedCity));
  }

  if (selectedType) {
    filtered = filtered.filter(post => normalizeText(post.fishing_type).includes(selectedType));
  }

  if (telegramOnly) {
    filtered = filtered.filter(post => cleanTelegram(post.telegram));
  }

  if (!filtered.length) {
    list.innerHTML = '<div class="info-line">Пока объявлений нет.</div>';
    return;
  }

  list.innerHTML = filtered.map(cardHtml).join("");
  setTimeout(updateHomeFloatButton, 80);
}

function cardHtml(post) {
  const tg = cleanTelegram(post.telegram);
  const ownerId = getOwnerId();
  const canManage = isAdmin() || (ownerId && post.owner_id === ownerId);
  const isFull = Boolean(post.crew_full);
  const image = getCardImage(post);
  const fishingType = post.fishing_type || "";
  const fishingTypeClass = getFishingTypeClass(fishingType);

  const name = post.name || "Рыбак";
  const city = post.city || "";
  const destination = post.destination || "";
  const tripTime = post.trip_time || "";
  const transport = post.transport || "";
  const seats = post.seats || "";
  const titleDestination = destination || city || "рыбалку";

  const tgButton = isFull
    ? `<button class="small-btn disabled" disabled onclick="event.stopPropagation()">Экипаж набран</button>`
    : tg
      ? `<button class="small-btn green" onclick="event.stopPropagation(); window.open('https://t.me/${escapeHtml(tg)}','_blank')">Написать автору</button>`
      : `<button class="small-btn green" onclick="event.stopPropagation(); openTelegram()">Написать в общий чат</button>`;

  const fullBtn = canManage
    ? `<button class="small-btn ${isFull ? "gray" : "blue"}" onclick="event.stopPropagation(); toggleCrewFull('${post.id}', ${isFull ? "false" : "true"})">${isFull ? "Снова ищу" : "Экипаж набран"}</button>`
    : "";

  const editBtn = canManage
    ? `<button class="small-btn yellow" onclick="event.stopPropagation(); editPost('${post.id}')">Редактировать</button>`
    : "";

  const deleteBtn = canManage
    ? `<button class="small-btn red" onclick="event.stopPropagation(); deletePost('${post.id}')">Удалить</button>`
    : "";

  const date = post.created_at
    ? new Date(post.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  return `
    <div class="card ${isFull ? "full" : ""}" onclick="openPostModal('${post.id}')">
      <div class="card-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.35)), url('${image}')"></div>

      <div class="card-body">
        <div class="trip-title">
          <span class="trip-name">${escapeHtml(name)}</span>
          <span> едет на </span>
          <span class="trip-destination">${escapeHtml(titleDestination)}</span>
        </div>

        <div class="trip-facts">
          <div class="trip-fact">
            <div class="trip-fact-label">Когда</div>
            <div class="trip-fact-value">${escapeHtml(tripTime || date || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Тип</div>
            <div class="trip-fact-value">${escapeHtml(fishingType || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Транспорт</div>
            <div class="trip-fact-value">${escapeHtml(transport || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Места</div>
            <div class="trip-fact-value">${escapeHtml(seats || (isFull ? "Экипаж набран" : "Уточнить"))}</div>
          </div>
        </div>

        <p class="trip-description">${escapeHtml(post.text || "")}</p>

        <div class="tags">
          <span class="tag">🎣 выезд</span>
          ${city ? `<span class="tag">📍 ${escapeHtml(city)}</span>` : ""}
          ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
          ${isFull ? '<span class="tag full">экипаж набран</span>' : ''}
          ${tg ? '<span class="tag">Telegram</span>' : ''}
          ${ownerId && post.owner_id === ownerId ? '<span class="tag">моё</span>' : ''}
        </div>

        <div class="actions">
          ${tgButton}
          ${fullBtn}
          ${editBtn}
          ${deleteBtn}
        </div>
      </div>
    </div>
  `;
}

function openPostModal(id) {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;

  activeModalPost = post;

  const modal = document.getElementById("postModal");
  const imageEl = document.getElementById("postModalImage");
  const titleEl = document.getElementById("postModalTitle");
  const metaEl = document.getElementById("postModalMeta");
  const textEl = document.getElementById("postModalText");
  const writeBtn = document.getElementById("postModalWriteBtn");

  if (!modal || !imageEl || !titleEl || !metaEl || !textEl || !writeBtn) return;

  const image = getCardImage(post);
  const tg = cleanTelegram(post.telegram);
  const isFull = Boolean(post.crew_full);
  const date = post.created_at
    ? new Date(post.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  const fishingType = post.fishing_type || "";
  const destination = post.destination || post.city || "рыбалку";

  imageEl.style.backgroundImage = `url('${image}')`;
  titleEl.textContent = `${post.name || "Рыбак"} едет на ${destination}`;
  textEl.textContent = post.text || "Описание не указано.";

  metaEl.innerHTML = `
    ${post.city ? `<span class="post-modal-pill">📍 Откуда: ${escapeHtml(post.city)}</span>` : ""}
    ${post.destination ? `<span class="post-modal-pill">🗺️ Куда: ${escapeHtml(post.destination)}</span>` : ""}
    ${post.trip_time ? `<span class="post-modal-pill">🕒 Когда: ${escapeHtml(post.trip_time)}</span>` : ""}
    ${fishingType ? `<span class="post-modal-pill">🎣 ${escapeHtml(fishingType)}</span>` : ""}
    ${post.transport ? `<span class="post-modal-pill">🚗 ${escapeHtml(post.transport)}</span>` : ""}
    ${post.seats ? `<span class="post-modal-pill">👥 ${escapeHtml(post.seats)}</span>` : ""}
    ${date ? `<span class="post-modal-pill">Создано: ${escapeHtml(date)}</span>` : ""}
    ${tg ? `<span class="post-modal-pill">Telegram</span>` : ""}
    ${isFull ? `<span class="post-modal-pill">Экипаж набран</span>` : ""}
  `;

  if (isFull) {
    writeBtn.textContent = "Экипаж уже набран";
    writeBtn.disabled = true;
  } else {
    writeBtn.textContent = "Написать";
    writeBtn.disabled = false;
  }

  clearTimeout(postModalCloseTimer);
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    modal.classList.add("open");
    document.body.classList.add("post-modal-open");
  });
}

function closePostModal() {
  const modal = document.getElementById("postModal");
  if (!modal) return;

  modal.classList.remove("open");
  document.body.classList.remove("post-modal-open");

  postModalCloseTimer = setTimeout(() => {
    modal.classList.add("hidden");
    activeModalPost = null;
  }, 360);
}

function handlePostModalBackdrop(event) {
  if (event.target && event.target.id === "postModal") {
    closePostModal();
  }
}

function writePostAuthor() {
  if (!activeModalPost) return;

  const tg = cleanTelegram(activeModalPost.telegram);

  if (tg) {
    window.open(`https://t.me/${tg}`, "_blank");
  } else {
    openTelegram();
  }
}

async function savePost() {
  if (typeof window.restoreAuthState === "function" && !authReady) {
    await window.restoreAuthState("before_save", false);
  }

  const name = document.getElementById("nameInput").value.trim();
  const city = document.getElementById("cityInput").value.trim();
  const destination = document.getElementById("destinationInput").value.trim();
  const tripTime = document.getElementById("tripTimeInput").value.trim();
  const fishingType = document.getElementById("fishingTypeInput").value.trim();
  const transport = document.getElementById("transportInput").value.trim();
  const seats = document.getElementById("seatsInput").value.trim();
  const text = document.getElementById("textInput").value.trim();
  const telegram = cleanTelegram(document.getElementById("telegramInput").value);

  if (typeof window.restoreAuthState === "function" && !currentUser) {
    await window.restoreAuthState("save_post_retry", false);
  }

  if (!currentUser) {
    showSection("auth");
    alert("Сначала создай профиль или войди. Так объявления будут защищены от удаления чужими людьми.");
    return;
  }

  if (!name || !city || !destination || !tripTime || !text) {
    showFormMessage("Заполни Nickname, город, куда едешь, когда и описание.", true);
    return;
  }

  saveAuthorLocal(name, telegram);

  const payload = {
    name,
    city,
    destination,
    trip_time: tripTime,
    fishing_type: fishingType,
    transport,
    seats,
    text,
    telegram,
    owner_id: currentUser.id
  };

  let result;

  if (editingId) {
    result = await supabaseClient
      .from("posts")
      .update(payload)
      .eq("id", editingId);
  } else {
    result = await supabaseClient
      .from("posts")
      .insert([{ ...payload, crew_full: false }]);
  }

  if (result.error) {
    showFormMessage("Не получилось сохранить. Проверь поля destination, trip_time, transport, seats в таблице posts.", true);
    console.error(result.error);
    return;
  }

  const wasEditing = Boolean(editingId);

  clearForm();

  if (typeof window.fillAuthorLocal === "function") {
    window.fillAuthorLocal();
  }

  editingId = null;
  document.getElementById("formTitle").innerText = "Создать выезд";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  showFormMessage(wasEditing ? "Выезд обновлён." : "Выезд создан.");

  await loadPosts();

  if (typeof window.klevbyReloadMap === "function") {
    window.klevbyReloadMap();
  }
}

function editPost(id) {
  const post = posts.find(p => String(p.id) === String(id));
  if (!post) return;

  editingId = id;

  document.getElementById("nameInput").value = post.name || "";
  document.getElementById("cityInput").value = post.city || "";
  document.getElementById("destinationInput").value = post.destination || "";
  document.getElementById("tripTimeInput").value = post.trip_time || "";
  document.getElementById("fishingTypeInput").value = post.fishing_type || "";
  document.getElementById("transportInput").value = post.transport || "";
  document.getElementById("seatsInput").value = post.seats || "";
  document.getElementById("textInput").value = post.text || "";
  document.getElementById("telegramInput").value = post.telegram || "";

  document.getElementById("formTitle").innerText = "Редактировать выезд";
  document.getElementById("cancelEditBtn").classList.remove("hidden");
  document.getElementById("createPanel").scrollIntoView({ behavior: "smooth" });
  setTimeout(updateHomeFloatButton, 120);
}

function cancelEdit() {
  editingId = null;
  clearForm();

  if (typeof window.fillAuthorLocal === "function") {
    window.fillAuthorLocal();
  }

  document.getElementById("formTitle").innerText = "Создать выезд";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  showFormMessage("");
}

function clearForm() {
  document.getElementById("nameInput").value = "";
  document.getElementById("cityInput").value = "";
  document.getElementById("destinationInput").value = "";
  document.getElementById("tripTimeInput").value = "";
  document.getElementById("fishingTypeInput").value = "";
  document.getElementById("transportInput").value = "";
  document.getElementById("seatsInput").value = "";
  document.getElementById("textInput").value = "";
  document.getElementById("telegramInput").value = "";
}

async function toggleCrewFull(id, value) {
  const { error } = await supabaseClient
    .from("posts")
    .update({ crew_full: value })
    .eq("id", id);

  if (error) {
    alert("Не получилось изменить статус. Проверь поле crew_full и RLS.");
    console.error(error);
    return;
  }

  await loadPosts();
}

async function deletePost(id) {
  if (!confirm("Удалить объявление? Это действие нельзя отменить.")) return;

  const { error } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Не получилось удалить. Удалять может только владелец объявления или админ.");
    console.error(error);
    return;
  }

  await loadPosts();

  if (typeof window.klevbyReloadMap === "function") {
    window.klevbyReloadMap();
  }
}

window.getOwnerId = getOwnerId;
window.cleanTelegram = cleanTelegram;
window.normalizeText = normalizeText;
window.escapeHtml = escapeHtml;
window.getFishingTypeClass = getFishingTypeClass;
window.getCardImage = getCardImage;
window.saveAuthorLocal = saveAuthorLocal;
window.loadPosts = loadPosts;
window.renderPosts = renderPosts;
window.cardHtml = cardHtml;
window.openPostModal = openPostModal;
window.closePostModal = closePostModal;
window.handlePostModalBackdrop = handlePostModalBackdrop;
window.writePostAuthor = writePostAuthor;
window.savePost = savePost;
window.editPost = editPost;
window.cancelEdit = cancelEdit;
window.clearForm = clearForm;
window.toggleCrewFull = toggleCrewFull;
window.deletePost = deletePost;
