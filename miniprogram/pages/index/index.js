const STORAGE_KEY = "single-cat-mini-state-v1";

const DAILY_LIMITS = {
  pet: { label: "抚摸", gain: 2, max: 10, mood: 2, state: "呼噜中" },
  feed: { label: "喂食", gain: 3, max: 5, mood: 3, state: "进食中" },
  play: { label: "玩耍", gain: 5, max: 5, mood: 4, state: "追球中" },
};

const LEVEL_STEPS = [50, 50, 50, 80, 80, 80, 120, 120, 120];
const FORTUNE_LEVELS = ["大吉", "中吉", "小吉", "平"];

const CAT_PROFILES = [
  { id: "cat-1", name: "团子", emoji: "🐱", pose: "/assets/cats/golden.png", baseFacing: 1, pointIndex: 0 },
  { id: "cat-2", name: "墨墨", emoji: "🐈", pose: "/assets/cats/black.png", baseFacing: 1, pointIndex: 2 },
  { id: "cat-3", name: "琥珀", emoji: "😺", pose: "/assets/cats/calico.png", baseFacing: 1, pointIndex: 3 },
  { id: "cat-4", name: "奶盖", emoji: "🐈‍⬛", pose: "/assets/cats/mainecoon.png", baseFacing: -1, pointIndex: 1 },
];

// 阶段2 逐帧动画：按「猫 × 动作」组织。dir 下 00.png..，JS 定时按 ms 切 src。
// 金渐层(cat-1) live 源图 ABCD 四行 → 四个动作（idle 摆尾 / groom 理毛 / sleep 困 / interact 喵叫）。
// 三花(cat-3) walk 走路循环。
const CAT_ANIM = {
  "cat-1": {
    idle: { dir: "/assets/cats/golden-idle/", count: 6, ms: 170 },
    groom: { dir: "/assets/cats/golden-groom/", count: 6, ms: 170 },
    sleep: { dir: "/assets/cats/golden-sleep/", count: 6, ms: 200 },
    interact: { dir: "/assets/cats/golden-meow/", count: 6, ms: 150 },
  },
  "cat-3": { walk: { dir: "/assets/cats/calico-walk/", count: 12, ms: 90 } },
};

function getAnim(catId, action) {
  const set = CAT_ANIM[catId];
  return set ? set[action] : null;
}

function animFrameSrc(anim, now) {
  if (!anim) return "";
  const idx = Math.floor(now / anim.ms) % anim.count;
  return `${anim.dir}${idx < 10 ? "0" : ""}${idx}.png`;
}

const SCENES = {
  cafe: {
    key: "cafe",
    name: "猫咖",
    mark: "咖",
    bg: "/assets/cafe.jpg",
    lines: ["奶泡会散，好运不散。", "先喝一口甜，再接一整天顺。", "被猫看见的人，都会被温柔对待。"],
    // 家具/吊扇/风铃/咖啡师已直接烘焙进背景图，运行时不再叠加道具
    props: [],
    // 锚点对应背景图中已烘焙家具的位置（x/y 为场景宽高百分比）
    anchors: [
      { x: 12, y: 56, layer: "high" },   // 沙发座位
      { x: 74, y: 44, layer: "high" },   // 猫爬架顶层
      { x: 10, y: 80, layer: "floor" },  // 猫窝
      { x: 46, y: 66, layer: "floor" },  // 地毯中央
      { x: 72, y: 57, layer: "high" },   // 猫爬架中层
      { x: 33, y: 86, layer: "floor" },  // 地面左前
      { x: 55, y: 85, layer: "floor" },  // 地面中前
      { x: 79, y: 80, layer: "floor" },  // 地面右前
    ],
  },
  courtyard: {
    key: "courtyard",
    name: "古风庭院",
    mark: "庭",
    bg: "/assets/courtyard.jpg",
    lines: ["愿你今日心安，所行皆缓而有得。", "愿你所盼，晚来不迟。", "愿你有风有月，也有猫相伴。"],
    anchors: [
      { x: 18, y: 82, layer: "floor" },
      { x: 32, y: 60, layer: "high" },
      { x: 50, y: 80, layer: "floor" },
      { x: 69, y: 62, layer: "high" },
      { x: 82, y: 82, layer: "floor" },
      { x: 45, y: 46, layer: "high" },
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
    pose: profile.pose,
    baseFacing: profile.baseFacing,
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
    return { ...createCat(profile), ...found, id: profile.id, emoji: profile.emoji, pose: profile.pose, baseFacing: profile.baseFacing, name: found.name || profile.name };
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
    playerInfo: { name: "玩家名字很长" },
    sceneProps: [],
    cats: [],
    hasSelected: false,
    selectedCat: null,
    nameInputValue: "",
    nameInputDisabled: true,
    nameInputPlaceholder: "请先在首页选中猫咪",
    display: {},
    limits: [],
    actionBtns: [],
    canBless: false,
    blessButtonText: "祈愿",
    homeTabClass: "active",
    albumNavClass: "",
    blessTabClass: "disabled",
    albumTabClass: { collection: "active", calendar: "", scenes: "" },
    albumList: [],

    calendarTitle: "",
    calendarCells: [],
    sceneAlbum: [],
    showBless: false,
    blessStageText: "准备中...",
    blessStageSub: "请静心等待好运显现",
    blessCatEmoji: "🐱",
    blessCatPose: "/assets/cats/golden.png",
    blessResult: null,
  },

  onLoad() {
    this.albumViewMonth = new Date();
    this.blessingInProgress = false;
    this.catRT = {};        // 运行时状态：{ [catId]: { facing, action, moveMs } }
    this.catTimers = {};    // 每只猫的动作回退定时器
    this.state = this.loadState();
    this.refresh();
    this.startBehaviorLoop();
    this.startFrameLoop();
  },

  onShow() {
    this.startBehaviorLoop();
    this.startFrameLoop();
  },

  onHide() {
    this.clearBehaviorLoop();
    this.clearFrameLoop();
  },

  onUnload() {
    this.clearBehaviorLoop();
    this.clearFrameLoop();
    Object.keys(this.catTimers || {}).forEach((id) => clearTimeout(this.catTimers[id]));
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

  getAnchor(sceneKey, idx) {
    const anchors = SCENES[sceneKey].anchors;
    return anchors[((idx % anchors.length) + anchors.length) % anchors.length];
  },

  buildProps() {
    const scene = SCENES[this.state.scene] || SCENES.cafe;
    const props = scene.props || [];
    return props.map((p) => {
      const translateY = p.pin === "top" ? "0" : "-100%";
      return {
        key: p.key,
        src: p.src,
        animClass: p.anim ? `prop-${p.anim}` : "",
        style: `left:${p.x}%; top:${p.y}%; width:${p.w}%; z-index:${p.z || 2}; transform: translate(-50%, ${translateY});`,
      };
    });
  },

  buildCats() {
    const sceneKey = this.state.scene;
    return this.state.catRoster.slice(0, 4).map((cat) => {
      const a = this.getAnchor(sceneKey, cat.pointIndex);
      const rt = this.catRT[cat.id] || {};
      const facing = rt.facing || cat.baseFacing || 1;
      const action = rt.action || "idle";
      const moveMs = rt.moveMs || 0;
      const selected = cat.id === this.state.selectedCatId;
      // 按纵坐标做深度排序：越靠下（y 越大）越靠前；选中置顶
      const z = Math.round(a.y) + (selected ? 400 : 0);
      // 当前动作有逐帧图时，pose 切为当前帧；不再叠加程序化动画 class
      const anim = getAnim(cat.id, action);
      return {
        id: cat.id,
        pose: anim ? animFrameSrc(anim, Date.now()) : cat.pose,
        style: `left:${a.x}%; top:${a.y}%; z-index:${z}; transition-duration:${moveMs}ms;`,
        flipClass: facing < 0 ? "flip" : "",
        actionClass: anim ? "" : action,
        activeClass: selected ? "active" : "",
      };
    });
  },

  refreshCats() {
    this.setData({ cats: this.buildCats() });
  },

  buildDisplay(selected) {
    if (!selected) {
      return {
        name: "",
        emoji: "",
        pose: "",
        level: "-",
        state: "",
        growth: 0,
        mood: 75,
        progress: 0,
      };
    }
    const level = getLevelInfo(selected.growth);
    return {
      name: selected.name,
      emoji: selected.emoji,
      pose: selected.pose,
      level: level.level,
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
      sceneProps: this.buildProps(),
      cats: this.buildCats(),
      hasSelected: Boolean(selected),
      selectedCat: selected,
      nameInputValue: selected ? selected.name : "",
      nameInputDisabled: !selected,
      nameInputPlaceholder: selected ? "请输入昵称" : "请先在首页选中猫咪",
      display: this.buildDisplay(selected),
      limits,
      actionBtns: limits,
      canBless,
      blessButtonText: selected && this.state.daily.blessed ? "已祈愿" : "祈愿",
      homeTabClass: this.data.currentView === "home" ? "active" : "",
      albumNavClass: this.data.currentView === "album" ? "active" : "",
      blessTabClass: canBless ? "" : "disabled",
      albumTabClass: {
        collection: this.data.albumTab === "collection" ? "active" : "",
        calendar: this.data.albumTab === "calendar" ? "active" : "",
        scenes: this.data.albumTab === "scenes" ? "active" : "",
      },
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
    this.clearCatTimer(catId);
    const rt = this.catRT[catId] || (this.catRT[catId] = {});
    rt.action = "idle";
    rt.moveMs = 0;
    this.state.selectedCatId = cat.id;
    cat.state = "看着你";
    this.saveState();
    this.refresh();
  },

  closeInteraction() {
    if (!this.state.selectedCatId) return;
    this.state.selectedCatId = null;
    this.saveState();
    this.refresh();
  },

  noop() {},

  // ---- 行为层：占位 / 移动 / 待机微动作 ----
  clearCatTimer(catId) {
    if (this.catTimers[catId]) {
      clearTimeout(this.catTimers[catId]);
      this.catTimers[catId] = null;
    }
  },

  setCatTimer(catId, ms, cb) {
    this.clearCatTimer(catId);
    this.catTimers[catId] = setTimeout(() => {
      this.catTimers[catId] = null;
      cb();
    }, ms);
  },

  occupiedAnchors(exceptCatId) {
    const set = new Set();
    this.state.catRoster.slice(0, 4).forEach((c) => {
      if (c.id !== exceptCatId) set.add(c.pointIndex);
    });
    return set;
  },

  // 把猫送到目标锚点：自动判断朝向、走/跳、按距离计算时长，结束后回到待机
  sendCatToAnchor(cat, targetIdx, stateText) {
    const sceneKey = this.state.scene;
    const from = this.getAnchor(sceneKey, cat.pointIndex);
    const to = this.getAnchor(sceneKey, targetIdx);
    const isJump = to.layer !== from.layer;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const moveMs = isJump ? 620 : Math.round(Math.min(3200, 1000 + dist * 55));
    const rt = this.catRT[cat.id] || (this.catRT[cat.id] = {});
    rt.facing = to.x < from.x ? -1 : (to.x > from.x ? 1 : (rt.facing || cat.baseFacing || 1));
    rt.action = isJump ? "jump" : "walk";
    rt.moveMs = moveMs;
    cat.pointIndex = targetIdx;
    cat.state = stateText || (isJump ? "跳跃中" : "散步中");
    this.refreshCats();
    this.setCatTimer(cat.id, moveMs, () => {
      rt.action = "idle";
      rt.moveMs = 0;
      cat.state = "待机中";
      this.saveState();
      this.refreshCats();
    });
  },

  microAction(cat) {
    const rt = this.catRT[cat.id] || (this.catRT[cat.id] = {});
    const act = randomPick(["groom", "sleep", "idle", "idle"]);
    rt.action = act;
    rt.moveMs = 0;
    cat.state = act === "groom" ? "理毛中" : act === "sleep" ? "打盹中" : "发呆中";
    this.refreshCats();
    const dur = act === "sleep" ? 3600 : 2200;
    this.setCatTimer(cat.id, dur, () => {
      rt.action = "idle";
      cat.state = "待机中";
      this.refreshCats();
    });
  },

  behaviorTick() {
    if (this.data.currentView !== "home" || this.blessingInProgress) return;
    const candidates = this.state.catRoster.slice(0, 4).filter((c) => {
      if (c.id === this.state.selectedCatId) return false;
      const rt = this.catRT[c.id] || {};
      return !rt.action || rt.action === "idle"; // 仅驱动空闲的猫，避免打断
    });
    if (!candidates.length) return;
    const cat = randomPick(candidates);
    const anchors = SCENES[this.state.scene].anchors;
    const occupied = this.occupiedAnchors(cat.id);
    const from = anchors[cat.pointIndex];

    // 三花猫优先在地面锚点间走动，便于验收走路帧
    if (cat.id === "cat-3" && from.layer === "floor" && Math.random() < 0.85) {
      const floorFree = anchors
        .map((a, i) => i)
        .filter((i) => i !== cat.pointIndex && !occupied.has(i) && anchors[i].layer === "floor");
      if (floorFree.length) {
        this.sendCatToAnchor(cat, randomPick(floorFree));
        return;
      }
    }

    if (Math.random() < 0.62) {
      const free = anchors
        .map((_, i) => i)
        .filter((i) => i !== cat.pointIndex && !occupied.has(i));
      if (free.length) {
        this.sendCatToAnchor(cat, randomPick(free));
        return;
      }
    }
    this.microAction(cat);
  },

  startFrameLoop() {
    this.clearFrameLoop();
    this.frameTimer = setInterval(() => this.tickFrames(), 80);
  },

  clearFrameLoop() {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  },

  // 按各猫当前动作推进逐帧动画，只在帧真正变化时定向更新对应 cats[i].pose
  tickFrames() {
    if (this.data.currentView !== "home") return;
    const now = Date.now();
    const cats = (this.data.cats || []).slice();
    let changed = false;
    this.state.catRoster.slice(0, 4).forEach((cat) => {
      const rt = this.catRT[cat.id] || {};
      const action = rt.action || "idle";
      const anim = getAnim(cat.id, action);
      if (!anim) return;
      const idx = cats.findIndex((c) => c.id === cat.id);
      if (idx < 0) return;
      const src = animFrameSrc(anim, now);
      if (cats[idx].pose !== src) {
        cats[idx] = { ...cats[idx], pose: src };
        changed = true;
      }
    });
    if (changed) this.setData({ cats });
  },

  startBehaviorLoop() {
    this.clearBehaviorLoop();
    this.behaviorTimer = setInterval(() => this.behaviorTick(), 2600);
  },

  clearBehaviorLoop() {
    if (this.behaviorTimer) {
      clearInterval(this.behaviorTimer);
      this.behaviorTimer = null;
    }
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
    const rt = this.catRT[selected.id] || (this.catRT[selected.id] = {});
    // 有喵叫帧的猫（金渐层）互动时播放 interact，其余沿用 groom
    rt.action = getAnim(selected.id, "interact") ? "interact" : "groom";
    rt.moveMs = 0;
    selected.state = conf.state;
    this.saveState();
    this.refresh();
    this.setCatTimer(selected.id, 1500, () => {
      rt.action = "idle";
      this.refreshCats();
    });
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
      blessCatPose: selected.pose,
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
    selected.state = "祈愿完成";
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

    const count = SCENES[next].anchors.length;
    this.state.catRoster = this.state.catRoster.map((cat, idx) => {
      this.clearCatTimer(cat.id);
      this.catRT[cat.id] = { facing: cat.baseFacing || 1, action: "idle", moveMs: 0 };
      return {
        ...cat,
        pointIndex: idx % count,
        state: "待机中",
      };
    });
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

});
