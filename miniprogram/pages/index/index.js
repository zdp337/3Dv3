const STORAGE_KEY = "single-cat-mini-state-v1";

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
    bg: "/assets/cafe.jpg",
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
    bg: "/assets/courtyard.jpg",
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
    daily: {
      date: todayKey(),
      actions: { pet: 0, feed: 0, play: 0 },
      blessed: false,
    },
    album: [],
  };
}

function normalizeState(parsed) {
  const base = createInitialState();
  const merged = { ...base, ...(parsed || {}) };
  merged.scene = SCENES[merged.scene] ? merged.scene : "cafe";
  merged.catRoster = CAT_PROFILES.map((profile) => {
    const found = (merged.catRoster || []).find((item) => item.id === profile.id) || {};
    return { ...createCat(profile), ...found, id: profile.id, emoji: profile.emoji, name: found.name || profile.name };
  });
  if (!merged.catRoster.some((cat) => cat.id === merged.selectedCatId)) merged.selectedCatId = null;
  const daily = merged.daily || {};
  const actions = daily.actions || {};
  merged.daily = {
    date: daily.date || todayKey(),
    actions: {
      pet: Number(actions.pet || 0),
      feed: Number(actions.feed || 0),
      play: Number(actions.play || 0),
    },
    blessed: Boolean(daily.blessed),
  };

  merged.album = Array.isArray(merged.album) ? merged.album : [];
  return merged;
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

Page({
  data: {
    currentView: "home",
    albumTab: "collection",
    state: createInitialState(),
    sceneConfig: SCENES.cafe,
    sceneOptions: [{ key: "cafe", name: "猫咖主题" }, { key: "courtyard", name: "庭院主题" }],
    sceneIndex: 0,
    cats: [],
    hasSelected: false,
    selectedCat: null,
    nameInputValue: "",
    display: {},
    limits: [],
    actionBtns: [],
    canBless: false,
    blessButtonText: "祈愿",
    albumList: [],
    calendarTitle: "",
    calendarCells: [],
    sceneAlbum: [],
    showBless: false,
    blessStageText: "准备中...",
    blessStageSub: "请静心等待好运显现",
    blessCatEmoji: "🐱",
    blessResult: null,
  },

  onLoad() {
    this.albumViewMonth = new Date();
    this.blessingInProgress = false;
    this.state = this.loadState();
    this.refresh();
    this.startWanderLoop();
  },

  onUnload() {
    if (this.wanderTimer) clearInterval(this.wanderTimer);
  },

  loadState() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      return raw ? normalizeState(raw) : createInitialState();
    } catch (err) {
      return createInitialState();
    }
  },

  saveState() {
    wx.setStorageSync(STORAGE_KEY, this.state);
  },

  ensureDailyReset() {
    const key = todayKey();
    if (this.state.daily.date !== key) {
      this.state.daily = {
        date: key,
        actions: { pet: 0, feed: 0, play: 0 },
        blessed: false,
      };
      this.saveState();
    }
  },

  getSelectedCat() {
    return this.state.catRoster.find((item) => item.id === this.state.selectedCatId) || null;
  },

  getPoint(sceneKey, pointIndex) {
    const points = SCENES[sceneKey].points;
    return points[((pointIndex % points.length) + points.length) % points.length];
  },

  buildCats() {
    return this.state.catRoster.slice(0, 4).map((cat) => {
      const point = this.getPoint(this.state.scene, cat.pointIndex);
      return {
        ...cat,
        x: point.x,
        y: point.y,
        activeClass: cat.id === this.state.selectedCatId ? "active" : "",
      };
    });
  },

  buildDisplay(selected) {
    if (!selected) {
      return {
        name: "玩家名字很长",
        level: "-",
        sceneLine: `${SCENES[this.state.scene].name} · 等待互动`,
        state: "点任意猫咪开始互动",
        growth: 0,
        mood: 75,
        progress: 0,
      };
    }
    const level = getLevelInfo(selected.growth);
    return {
      name: selected.name,
      level: level.level,
      sceneLine: `${SCENES[this.state.scene].name} · ${selected.state}`,
      state: selected.state,
      growth: selected.growth,
      mood: selected.mood,
      progress: level.progress,
    };
  },

  buildLimits(selected) {
    return Object.keys(DAILY_LIMITS).map((key) => {
      const item = DAILY_LIMITS[key];
      const used = this.state.daily.actions[key] || 0;
      return {
        key,
        label: item.label,
        gain: item.gain,
        max: item.max,
        used,
        disabled: !selected || used >= item.max,
      };
    });
  },

  buildCalendarCells() {
    const now = this.albumViewMonth || new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blessMap = {};
    this.state.album.forEach((card) => {
      blessMap[card.date] = card;
    });

    const cells = [];
    for (let i = 0; i < startWeek; i += 1) {
      cells.push({ key: `empty-${year}-${month}-${i}`, day: "", emptyClass: "empty", blessedClass: "" });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const card = blessMap[dateKey];
      const scene = card ? SCENES[card.sceneKey] || SCENES.cafe : null;
      cells.push({
        key: dateKey,
        day,
        emptyClass: "",
        blessedClass: card ? "blessed" : "",
        mark: scene ? scene.mark : "",
        markClass: scene ? scene.key : "",
      });
    }

    return {
      title: `${year}-${String(month + 1).padStart(2, "0")}`,
      cells,
    };
  },

  buildSceneAlbum() {
    const unlocked = new Set(this.state.album.map((card) => card.sceneKey));
    return Object.values(SCENES).map((scene) => ({
      key: scene.key,
      name: scene.name,
      status: unlocked.has(scene.key) ? "已收集" : "未收集",
      desc: unlocked.has(scene.key) ? "该场景已产出过祈愿卡" : "在该场景完成一次祈愿后解锁",
      lockedClass: unlocked.has(scene.key) ? "" : "locked",
    }));
  },

  refresh() {
    this.ensureDailyReset();
    const selected = this.getSelectedCat();
    const scene = SCENES[this.state.scene] || SCENES.cafe;
    const calendar = this.buildCalendarCells();
    const limits = this.buildLimits(selected);
    const canBless = Boolean(selected) && !this.state.daily.blessed && !this.blessingInProgress;

    this.setData({
      state: this.state,
      sceneConfig: scene,
      sceneIndex: this.data.sceneOptions.findIndex((item) => item.key === this.state.scene),
      cats: this.buildCats(),
      hasSelected: Boolean(selected),
      selectedCat: selected,
      nameInputValue: selected ? selected.name : "",
      display: this.buildDisplay(selected),
      limits,
      actionBtns: limits,
      canBless,
      blessButtonText: selected && this.state.daily.blessed ? "已祈愿" : "祈愿",
      albumList: this.state.album,
      calendarTitle: calendar.title,
      calendarCells: calendar.cells,
      sceneAlbum: this.buildSceneAlbum(),
    });
  },

  switchView(e) {
    const view = e.currentTarget.dataset.view;
    if (!view) return;
    this.setData({ currentView: view });
    this.refresh();
  },

  handleSideTool(e) {
    const action = e.currentTarget.dataset.action;
    if (action === "settings") {
      this.setData({ currentView: "settings" });
      this.refresh();
      return;
    }
    wx.showToast({ title: action === "friends" ? "好友系统开发中" : "邮件系统开发中", icon: "none" });
  },

  selectCat(e) {
    if (this.blessingInProgress) return;
    const catId = e.currentTarget.dataset.id;
    const cat = this.state.catRoster.find((item) => item.id === catId);
    if (!cat) return;
    this.state.selectedCatId = cat.id;
    cat.state = "看着你";
    this.saveState();
    this.refresh();
  },

  moveCatTo(catId, pointIndex, stateText) {
    const cat = this.state.catRoster.find((item) => item.id === catId);
    if (!cat) return;
    const points = SCENES[this.state.scene].points;
    cat.pointIndex = ((pointIndex % points.length) + points.length) % points.length;
    cat.state = stateText;
  },

  applyAction(e) {
    const action = e.currentTarget.dataset.action;
    const conf = DAILY_LIMITS[action];
    const selected = this.getSelectedCat();
    if (!conf || !selected || this.blessingInProgress) return;
    const used = this.state.daily.actions[action] || 0;
    if (used >= conf.max) return;

    this.state.daily.actions[action] = used + 1;
    selected.growth += conf.gain;
    selected.mood = Math.min(100, selected.mood + conf.mood);
    this.moveCatTo(selected.id, Math.floor(Math.random() * SCENES[this.state.scene].points.length), conf.state);
    this.saveState();
    this.refresh();
  },

  async startBlessing() {
    const selected = this.getSelectedCat();
    if (!selected) {
      wx.showToast({ title: "先点一只猫再祈愿", icon: "none" });
      return;
    }
    if (this.state.daily.blessed || this.blessingInProgress) {
      wx.showToast({ title: "今日已祈愿", icon: "none" });
      return;
    }

    this.blessingInProgress = true;
    const scene = SCENES[this.state.scene];
    this.setData({
      showBless: true,
      blessResult: null,
      blessCatEmoji: selected.emoji,
      blessStageText: scene.key === "cafe" ? "杯套写下今日口令" : "祈愿签缓缓展开",
      blessStageSub: `第一幕：${selected.name}陪你开始祈愿`,
    });
    await wait(1000);

    this.setData({
      blessStageText: scene.key === "cafe" ? "暖光漫开，杯盖轻启" : "花瓣流转，签文点亮",
      blessStageSub: "第二幕：主画面正在呈现今日祝福",
    });
    await wait(1000);

    const card = {
      id: `card-${Date.now()}`,
      date: this.state.daily.date,
      scene: scene.name,
      sceneKey: scene.key,
      fortune: randomPick(FORTUNE_LEVELS),
      keyword: randomPick(scene.lines),
      catName: selected.name,
    };

    this.state.daily.blessed = true;
    selected.growth += 8;
    selected.mood = Math.min(100, selected.mood + 4);
    this.moveCatTo(selected.id, 0, "祈愿完成");
    const existing = this.state.album.findIndex((item) => item.date === card.date);
    if (existing >= 0) this.state.album[existing] = card;
    else this.state.album.unshift(card);
    this.saveState();
    this.blessingInProgress = false;

    this.setData({
      blessStageText: "运势揭晓",
      blessStageSub: "第三幕：请收下你的今日祈愿卡",
      blessResult: card,
    });
    this.refresh();
  },

  closeBless() {
    this.setData({ showBless: false });
  },

  goAlbumFromBless() {
    this.setData({ showBless: false, currentView: "album", albumTab: "collection" });
    this.refresh();
  },

  switchAlbumTab(e) {
    this.setData({ albumTab: e.currentTarget.dataset.tab });
    this.refresh();
  },

  prevMonth() {
    const base = this.albumViewMonth || new Date();
    this.albumViewMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    this.refresh();
  },

  nextMonth() {
    const base = this.albumViewMonth || new Date();
    this.albumViewMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    this.refresh();
  },

  changeName(e) {
    const selected = this.getSelectedCat();
    if (!selected) return;
    selected.name = e.detail.value.trim() || selected.name;
    this.saveState();
    this.refresh();
  },

  changeScene(e) {
    const option = this.data.sceneOptions[Number(e.detail.value)];
    const next = option ? option.key : "cafe";
    this.state.scene = next;

    this.state.catRoster = this.state.catRoster.map((cat, idx) => ({
      ...cat,
      pointIndex: (cat.pointIndex + idx + 1) % SCENES[next].points.length,
      state: cat.id === this.state.selectedCatId ? "切换场景中" : cat.state,
    }));
    this.saveState();
    this.refresh();
  },

  toggleSound(e) {
    this.state.soundEnabled = e.detail.value;
    this.saveState();
    this.refresh();
  },

  resetDaily() {
    this.state.daily = {
      date: todayKey(),
      actions: { pet: 0, feed: 0, play: 0 },
      blessed: false,
    };
    const selected = this.getSelectedCat();
    if (selected) selected.state = "等待互动";
    this.saveState();
    this.refresh();
    wx.showToast({ title: "今日次数已重置", icon: "none" });
  },

  resetAll() {
    wx.showModal({
      title: "清空存档",
      content: "确认清空全部本地存档？该操作不可恢复。",
      success: (res) => {
        if (!res.confirm) return;
        this.state = createInitialState();
        this.albumViewMonth = new Date();
        this.blessingInProgress = false;
        this.saveState();
        this.setData({ currentView: "home", albumTab: "collection", showBless: false, blessResult: null });
        this.refresh();
      },
    });
  },

  startWanderLoop() {
    this.wanderTimer = setInterval(() => {
      if (this.data.currentView !== "home" || this.blessingInProgress) return;
      const cats = this.state.catRoster;
      const randomCat = randomPick(cats);
      this.moveCatTo(randomCat.id, Math.floor(Math.random() * SCENES[this.state.scene].points.length), "悠闲散步中");
      this.saveState();
      this.refresh();
    }, 5000);
  },
});
