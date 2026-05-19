const STORAGE_KEY = "single-cat-mvp-state-v6";

const DAILY_LIMITS = {
  pet: { label: "抚摸", gain: 2, max: 10, mood: 2, state: "呼噜中" },
  feed: { label: "喂食", gain: 3, max: 5, mood: 3, state: "进食中" },
  play: { label: "玩耍", gain: 5, max: 5, mood: 4, state: "追球中" },
};

const LEVEL_STEPS = [50, 50, 50, 80, 80, 80, 120, 120, 120];
const FORTUNE_LEVELS = ["大吉", "中吉", "小吉", "平"];

const CAT_PROFILES = [
  { id: "cat-1", name: "团子", emoji: "🐱", pointIndex: 1 },
  { id: "cat-2", name: "墨墨", emoji: "🐈", pointIndex: 3 },
  { id: "cat-3", name: "琥珀", emoji: "😺", pointIndex: 4 },
  { id: "cat-4", name: "奶盖", emoji: "🐈‍⬛", pointIndex: 0 },
];

const SCENES = {
  cafe: {
    key: "cafe",
    name: "猫咖",
    mark: "咖",
    ritual: "猫咪从吧台旁走来，叼着今日口令杯套。",
    lines: ["奶泡会散，好运不散。", "先喝一口甜，再接一整天顺。", "被猫看见的人，都会被温柔对待。"],
    points: [
      { x: 16, y: 84 },
      { x: 24, y: 68 },
      { x: 43, y: 77 },
      { x: 62, y: 53 },
      { x: 73, y: 76 },
      { x: 84, y: 68 },
    ],
  },
  courtyard: {
    key: "courtyard",
    name: "古风庭院",
    mark: "庭",
    ritual: "猫咪叼来祈愿签，在圆窗前停步等你落签。",
    lines: ["愿你今日心安，所行皆缓而有得。", "愿你所盼，晚来不迟。", "愿你有风有月，也有猫相伴。"],
    points: [
      { x: 15, y: 84 },
      { x: 25, y: 53 },
      { x: 48, y: 72 },
      { x: 69, y: 55 },
      { x: 79, y: 78 },
      { x: 41, y: 42 },
    ],
  },
};

let albumViewMonth = null;
let blessingInProgress = false;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeCard(item) {
  const guessedSceneKey = item.sceneKey || (item.scene === "古风庭院" ? "courtyard" : "cafe");
  return {
    id: item.id,
    date: item.date,
    scene: item.scene || SCENES[guessedSceneKey].name,
    sceneKey: guessedSceneKey,
    fortune: item.fortune,
    keyword: item.keyword,
    catName: item.catName || "",
  };
}

function createCat(profile) {
  return {
    id: profile.id,
    name: profile.name,
    emoji: profile.emoji,
    pointIndex: profile.pointIndex,
    growth: 0,
    mood: 75,
    state: "待机中",
  };
}

function createInitialState() {
  return {
    scene: "cafe",
    soundEnabled: true,
    selectedCatId: null,
    catRoster: CAT_PROFILES.map(createCat),
    albumTab: "collection",
    daily: {
      date: todayKey(),
      actions: { pet: 0, feed: 0, play: 0 },
      blessed: false,
    },
    album: [],
  };
}

function migrateRoster(merged, parsed) {
  const oldName = parsed?.catName || "团子";
  const oldGrowth = Number(parsed?.growth) || 0;
  const oldMood = Number(parsed?.mood) || 75;
  const oldPoint = Number.isFinite(parsed?.catPointIndex) ? parsed.catPointIndex : 1;
  const oldState = parsed?.catState || "待机中";

  if (!Array.isArray(merged.catRoster) || !merged.catRoster.length) {
    const roster = CAT_PROFILES.map(createCat);
    roster[0].name = oldName;
    roster[0].growth = oldGrowth;
    roster[0].mood = oldMood;
    roster[0].pointIndex = oldPoint;
    roster[0].state = oldState;
    return roster;
  }

  return CAT_PROFILES.map((profile, idx) => {
    const found = merged.catRoster.find((item) => item.id === profile.id) || {};
    return {
      ...createCat(profile),
      ...found,
      id: profile.id,
      emoji: profile.emoji,
      name: found.name || profile.name,
      pointIndex: Number.isFinite(found.pointIndex) ? found.pointIndex : profile.pointIndex,
      growth: Number.isFinite(found.growth) ? found.growth : (idx === 0 ? oldGrowth : 0),
      mood: Number.isFinite(found.mood) ? found.mood : (idx === 0 ? oldMood : 75),
      state: found.state || (idx === 0 ? oldState : "待机中"),
    };
  });
}

function normalizeState(parsed) {
  const merged = { ...createInitialState(), ...parsed };
  merged.album = (merged.album || []).map(normalizeCard);
  merged.catRoster = migrateRoster(merged, parsed);

  const ids = new Set(merged.catRoster.map((item) => item.id));
  if (!ids.has(merged.selectedCatId)) merged.selectedCatId = null;

  merged.daily = {
    date: merged.daily?.date || todayKey(),
    actions: {
      pet: Number(merged.daily?.actions?.pet || 0),
      feed: Number(merged.daily?.actions?.feed || 0),
      play: Number(merged.daily?.actions?.play || 0),
    },
    blessed: Boolean(merged.daily?.blessed),
  };

  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureDailyReset() {
  const key = todayKey();
  if (state.daily.date !== key) {
    state.daily = {
      date: key,
      actions: { pet: 0, feed: 0, play: 0 },
      blessed: false,
    };
    saveState();
  }
}

function getLevelInfo(growth) {
  let remain = growth;
  let level = 1;
  for (let i = 0; i < LEVEL_STEPS.length; i += 1) {
    const need = LEVEL_STEPS[i];
    if (remain < need) return { level, progress: Math.floor((remain / need) * 100) };
    remain -= need;
    level += 1;
  }
  return { level: 10, progress: 100 };
}

function getSelectedCat() {
  return state.catRoster.find((item) => item.id === state.selectedCatId) || null;
}

function switchView(tab) {
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${tab}`));
}

function switchAlbumTab(tab) {
  state.albumTab = tab;
  saveState();
  document.querySelectorAll(".album-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.albumTab === tab));
  document.querySelectorAll(".album-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `album-panel-${tab}`));
}

function getPoint(sceneKey, pointIndex) {
  const points = SCENES[sceneKey].points;
  return points[((pointIndex % points.length) + points.length) % points.length];
}

function renderCats() {
  const wrap = document.getElementById("cats-stage");
  wrap.innerHTML = state.catRoster
    .slice(0, 4)
    .map((cat) => {
      const p = getPoint(state.scene, cat.pointIndex);
      const active = cat.id === state.selectedCatId ? "active" : "";
      return `<button class="cat-unit ${active}" data-cat-id="${cat.id}" style="left:${p.x}%;top:${p.y}%" title="选择${cat.name}">${cat.emoji}</button>`;
    })
    .join("");
}

function moveCatTo(catId, pointIndex, stateText = "散步中") {
  const cat = state.catRoster.find((item) => item.id === catId);
  if (!cat) return;

  const points = SCENES[state.scene].points;
  cat.pointIndex = ((pointIndex % points.length) + points.length) % points.length;
  cat.state = stateText;

  if (cat.id === state.selectedCatId) {
    document.getElementById("cat-state").textContent = stateText;
  }

  renderCats();
}

function selectCat(catId) {
  const cat = state.catRoster.find((item) => item.id === catId);
  if (!cat) return;
  state.selectedCatId = cat.id;
  cat.state = "看着你";
  saveState();
  renderHome();
  renderSettings();
  renderCats();
}

function applyAction(action) {
  const conf = DAILY_LIMITS[action];
  const selected = getSelectedCat();
  if (!conf || blessingInProgress || !selected) return;

  const used = state.daily.actions[action] || 0;
  if (used >= conf.max) return;

  state.daily.actions[action] = used + 1;
  selected.growth += conf.gain;
  selected.mood = Math.min(100, selected.mood + conf.mood);

  const points = SCENES[state.scene].points;
  moveCatTo(selected.id, Math.floor(Math.random() * points.length), conf.state);

  saveState();
  render();
}

function getBlessMap() {
  const map = {};
  state.album.forEach((card) => {
    map[card.date] = card;
  });
  return map;
}

function addOrReplaceTodayCard(card) {
  const idx = state.album.findIndex((item) => item.date === card.date);
  if (idx >= 0) state.album[idx] = card;
  else state.album.unshift(card);
}

function showSideTip(text) {
  const selected = getSelectedCat();
  document.getElementById("cat-state").textContent = text;
  if (selected) {
    selected.state = text;
    saveState();
  }
}

async function startBlessingFlow() {
  if (state.daily.blessed || blessingInProgress) return;

  const selected = getSelectedCat();
  if (!selected) {
    showSideTip("先点一只猫再祈愿");
    return;
  }

  blessingInProgress = true;
  const overlay = document.getElementById("bless-overlay");
  const stageText = document.getElementById("bless-stage-text");
  const stageSub = document.getElementById("bless-stage-sub");
  const resultCard = document.getElementById("bless-result-card");
  const actions = document.getElementById("bless-actions");
  const blessTag = document.getElementById("bless-scene-tag");
  const blessCat = document.getElementById("bless-cat");

  try {
    resultCard.classList.add("hidden");
    actions.classList.add("hidden");
    overlay.classList.remove("hidden");

    const conf = SCENES[state.scene] || SCENES.cafe;
    blessTag.textContent = `${conf.name}祈福`;
    blessCat.textContent = selected.emoji;

    stageText.textContent = conf.key === "cafe" ? "杯套写下今日口令" : "祈愿签缓缓展开";
    stageSub.textContent = `第一幕：${selected.name}陪你开始祈福`;
    await wait(1200);

    stageText.textContent = conf.key === "cafe" ? "暖光漫开，杯盖轻启" : "花瓣流转，签文点亮";
    stageSub.textContent = "第二幕：主画面正在呈现今日祝福";
    await wait(1200);

    stageText.textContent = "运势揭晓";
    stageSub.textContent = "第三幕：请收下你的今日祈福卡";

    const card = {
      id: `card-${Date.now()}`,
      date: state.daily.date,
      scene: conf.name,
      sceneKey: conf.key,
      fortune: randomPick(FORTUNE_LEVELS),
      keyword: randomPick(conf.lines),
      catName: selected.name,
    };

    state.daily.blessed = true;
    selected.growth += 8;
    selected.mood = Math.min(100, selected.mood + 4);
    addOrReplaceTodayCard(card);
    moveCatTo(selected.id, 0, "祈福完成");

    resultCard.innerHTML = `<div><strong>${card.date}</strong> · ${card.scene} · <strong>${card.fortune}</strong></div><div style="margin-top:6px;">${card.keyword}</div><div style="margin-top:6px;color:#6a7387;">${selected.name}的祝福已收录至图鉴</div>`;
    resultCard.classList.remove("hidden");
    actions.classList.remove("hidden");

    saveState();
    renderBlessResult(card);
    render();
  } catch {
    stageText.textContent = "祈福流程异常";
    stageSub.textContent = "请点击“收下并返回”后重试";
    actions.classList.remove("hidden");
  } finally {
    blessingInProgress = false;
  }
}

function closeBlessOverlay() {
  document.getElementById("bless-overlay").classList.add("hidden");
}

function renderBlessResult(card) {
  const box = document.getElementById("fortune-result");
  box.classList.remove("hidden");
  const catPart = card.catName ? ` · ${card.catName}` : "";
  box.innerHTML = `<div><strong>${card.date}</strong> · ${card.scene}${catPart} · <strong>${card.fortune}</strong></div><div style="margin-top:4px;">${card.keyword}</div>`;
}

function renderHome() {
  const selected = getSelectedCat();
  const interactionPanel = document.getElementById("interaction-panel");

  const limits = document.getElementById("limits-list");
  limits.innerHTML = Object.entries(DAILY_LIMITS)
    .map(([k, v]) => `<li>${v.label}：${state.daily.actions[k] || 0}/${v.max}</li>`)
    .join("");

  document.querySelectorAll(".action-btn").forEach((btn) => {
    const conf = DAILY_LIMITS[btn.dataset.action];
    btn.disabled = !selected || (state.daily.actions[btn.dataset.action] || 0) >= conf.max;
  });

  const blessBtn = document.getElementById("bless-btn");
  blessBtn.disabled = state.daily.blessed || blessingInProgress || !selected;
  if (!selected) {
    blessBtn.textContent = "祈愿";
  } else {
    blessBtn.textContent = state.daily.blessed ? "已祈愿" : "祈愿";
  }

  if (selected) {
    document.getElementById("cat-name").textContent = selected.name;
    document.getElementById("scene-name").textContent = `${SCENES[state.scene].name} · ${selected.state}`;
    document.getElementById("cat-state").textContent = selected.state;
    document.getElementById("growth-value").textContent = selected.growth;
    document.getElementById("mood-value").textContent = selected.mood;

    const level = getLevelInfo(selected.growth);
    document.getElementById("level-value").textContent = level.level;
    document.getElementById("progress-fill").style.width = `${level.progress}%`;
    interactionPanel.classList.remove("hidden");
  } else {
    document.getElementById("cat-name").textContent = "玩家名字很长";
    document.getElementById("scene-name").textContent = `${SCENES[state.scene].name} · 等待互动`;
    document.getElementById("cat-state").textContent = "点任意猫咪开始互动";
    document.getElementById("level-value").textContent = "-";
    document.getElementById("growth-value").textContent = "0";
    document.getElementById("mood-value").textContent = "75";
    document.getElementById("progress-fill").style.width = "0%";
    interactionPanel.classList.add("hidden");
  }

  const todayCard = state.album.find((x) => x.date === state.daily.date);
  if (todayCard) renderBlessResult(todayCard);
  else document.getElementById("fortune-result").classList.add("hidden");
}

function renderCollectionPanel() {
  const list = document.getElementById("album-list");
  if (!state.album.length) {
    list.className = "album-list empty";
    list.textContent = "还没有卡片，先完成今日祈福。";
    return;
  }

  list.className = "album-list";
  list.innerHTML = state.album
    .map((item) => {
      const catPart = item.catName ? ` · ${item.catName}` : "";
      return `<article class="card-item"><div><strong>${item.date}</strong> · ${item.scene}${catPart}</div><div>${item.fortune} · ${item.keyword}</div></article>`;
    })
    .join("");
}

function renderSceneAlbum() {
  const blessedSceneKeys = new Set(state.album.map((card) => normalizeCard(card).sceneKey));
  const wrap = document.getElementById("scene-album");
  wrap.innerHTML = Object.values(SCENES)
    .map((scene) => {
      const unlocked = blessedSceneKeys.has(scene.key);
      return `<article class="scene-item ${unlocked ? "" : "locked"}"><div><strong>${scene.name}</strong> ${unlocked ? "✅ 已收集" : "🔒 未收集"}</div><div style="margin-top:4px;color:#6a7387;">${unlocked ? "该场景已产出过祈福卡" : "在该场景完成一次祈福后解锁"}</div></article>`;
    })
    .join("");
}

function renderCalendarPanel() {
  const now = albumViewMonth || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeek = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blessMap = getBlessMap();

  document.getElementById("calendar-title").textContent = `${year}-${String(month + 1).padStart(2, "0")}`;

  const cells = [];
  for (let i = 0; i < startWeek; i += 1) cells.push('<div class="day-cell empty"></div>');

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const card = blessMap[dateKey];
    if (card) {
      const normalized = normalizeCard(card);
      cells.push(`<div class="day-cell blessed"><div>${day}</div><div class="day-mark ${normalized.sceneKey}">${SCENES[normalized.sceneKey].mark}</div></div>`);
    } else {
      cells.push(`<div class="day-cell"><div>${day}</div></div>`);
    }
  }

  document.getElementById("calendar-grid").innerHTML = cells.join("");
}

function renderAlbum() {
  document.getElementById("collection-count").textContent = `共 ${state.album.length} 张`;
  switchAlbumTab(state.albumTab || "collection");
  renderCollectionPanel();
  renderCalendarPanel();
  renderSceneAlbum();
}

function renderSettings() {
  const selected = getSelectedCat();
  const nameInput = document.getElementById("name-input");
  const sceneSelect = document.getElementById("scene-select");
  document.getElementById("sound-toggle").checked = state.soundEnabled;
  sceneSelect.value = state.scene;

  if (selected) {
    nameInput.disabled = false;
    nameInput.placeholder = "请输入昵称";
    nameInput.value = selected.name;
  } else {
    nameInput.disabled = true;
    nameInput.value = "";
    nameInput.placeholder = "请先在首页选中猫咪";
  }
}

function renderScene() {
  const phone = document.getElementById("phone");
  phone.dataset.scene = state.scene;
  renderCats();
}

function render() {
  ensureDailyReset();
  renderScene();
  renderHome();
  renderAlbum();
  renderSettings();
}

function bindEvents() {
  document.getElementById("tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab[data-tab]");
    if (!tab) return;
    switchView(tab.dataset.tab);
  });

  document.getElementById("bless-btn").addEventListener("click", startBlessingFlow);

  document.getElementById("album-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".album-tab");
    if (!btn) return;
    switchAlbumTab(btn.dataset.albumTab);
  });

  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyAction(btn.dataset.action));
  });

  document.getElementById("cats-stage").addEventListener("click", (e) => {
    const target = e.target.closest(".cat-unit");
    if (!target || blessingInProgress) return;
    selectCat(target.dataset.catId);
  });

  document.getElementById("side-tools").addEventListener("click", (e) => {
    const target = e.target.closest(".tool-entry");
    if (!target) return;

    const action = target.dataset.sideAction;
    if (action === "settings") {
      switchView("settings");
      return;
    }
    if (action === "friends") {
      showSideTip("好友系统开发中");
      return;
    }
    if (action === "mail") {
      showSideTip("邮件系统开发中");
    }
  });

  document.getElementById("bless-close").addEventListener("click", closeBlessOverlay);
  document.getElementById("bless-to-album").addEventListener("click", () => {
    closeBlessOverlay();
    switchView("album");
  });

  document.getElementById("name-input").addEventListener("change", (e) => {
    const selected = getSelectedCat();
    if (!selected) return;
    selected.name = e.target.value.trim() || selected.name;
    saveState();
    renderHome();
    renderSettings();
  });

  document.getElementById("scene-select").addEventListener("change", (e) => {
    state.scene = e.target.value;
    state.catRoster = state.catRoster.map((cat, idx) => ({
      ...cat,
      pointIndex: (cat.pointIndex + idx + 1) % SCENES[state.scene].points.length,
      state: cat.id === state.selectedCatId ? "切换场景中" : cat.state,
    }));
    saveState();
    render();
  });

  document.getElementById("sound-toggle").addEventListener("change", (e) => {
    state.soundEnabled = e.target.checked;
    saveState();
  });

  document.getElementById("reset-daily-btn").addEventListener("click", resetDailyProgress);
  document.getElementById("reset-all-btn").addEventListener("click", resetAllProgress);

  document.getElementById("month-prev").addEventListener("click", () => {

    const base = albumViewMonth || new Date();
    albumViewMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    renderCalendarPanel();
  });

  document.getElementById("month-next").addEventListener("click", () => {
    const base = albumViewMonth || new Date();
    albumViewMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    renderCalendarPanel();
  });
}

function startWanderLoop() {
  setInterval(() => {
    const homeActive = document.getElementById("view-home").classList.contains("active");
    if (!homeActive || blessingInProgress) return;

    const points = SCENES[state.scene].points;
    const randomCat = randomPick(state.catRoster);
    moveCatTo(randomCat.id, Math.floor(Math.random() * points.length), "悠闲散步中");
    saveState();

    if (randomCat.id === state.selectedCatId) renderHome();
  }, 5000);
}

let state = loadState();
bindEvents();
render();
startWanderLoop();
