# 开发记录（倒序，最新在最上面）

> 约定：每完成一项会改动代码的任务，在此追加条目，格式：日期 / 改动内容 / 原因 / 验收方式。
> 决策类（不改代码）的结论也记录在此，方便跨设备恢复上下文。

## 2026-06-16

### 金渐层 ABCD 四动作接入 + 三花朝向修正 + 量化压缩
- 用户反馈：① 金渐层 live 源图分 ABCD 四行，每行一个动作，按分组全做；② 三花模型朝向与移动方向相反，需修正。
- 三花朝向修正：`calico-walk` 之前 `flip=True` 导致帧朝左，而静态 `calico.png` 与 facing 逻辑默认朝右 → 走路时面朝与移动方向相反。改为 `flip=False`（帧朝右，与静态一致；朝左时由 CSS `scaleX(-1)` 翻转）。
- 金渐层四动作：`tools/build_walk_poc.py` 的 JOBS 增加三行 → `golden-idle`(B摆尾)/`golden-groom`(C理毛)/`golden-sleep`(D困)/`golden-meow`(A喵叫)，均朝右不翻转。
- `index.js`：`CAT_ANIM["cat-1"]` 映射 idle/groom/sleep/interact 四动作；`applyAction` 改为「有 interact 帧的猫（金渐层）互动时播 interact 喵叫，其余沿用 groom」，回退时长 1200→1500ms。微动作 groom/sleep 也会命中金渐层对应帧。
- 体积优化：导出宽 160→132px + 调色板量化 96 色（FASTOCTREE），单帧从约 36KB 降到约 4KB；已验证在背景上无白边/锯齿。主包资源 1.44MB → **0.98MB**（含 5 套帧）。
- 效果：金渐层 idle 摆尾、被互动时喵叫、随机理毛/打盹都有帧动画；三花走路朝向正确。

### 调整：移除预览卡 + 优先金渐层 idle 摆尾（通用逐帧动画）
- 用户反馈：① 三花猫走路已生效，但顶部 POC 预览卡（红框）是多余内容，去掉；② 优先用金渐层素材——它是「静止时的小动作」，因为猫多数时间处于 idle，效果持续可见更明显。
- 移除：POC 预览卡（wxml/wxss/js 的 `pocWalkDemo`/`pocFrameSrc` 全删）。
- 通用化逐帧动画：`WALK_FRAMES` → `CAT_ANIM`，按「猫 × 动作」组织，每条带 `dir/count/ms`：
  - `cat-1`（金渐层）`idle` → `assets/cats/golden-idle/`（摆尾 6 帧，ms 170）。
  - `cat-3`（三花）`walk` → `assets/cats/calico-walk/`（走路 12 帧，ms 90）。
  - `buildCats` 按当前 action 查 `getAnim`，命中则 pose 取帧、清掉程序化动画 class；帧循环 `tickFrames`（80ms）用 `Date.now()/ms` 算帧，仅帧变化时定向更新 `cats[i].pose`。
- 素材：`tools/build_walk_poc.py` 通用化为 `JOBS` 列表，一次导出三花走路 + 金渐层 idle；金渐层不翻转（`tailwag` 朝向与静态 `golden.png` 一致）。主包资源约 1.44MB。
- 效果：金渐层默认 idle 时持续摆尾（最常见状态，明显可见）；三花地面走动时腿动。其余两猫暂静态。

### 阶段2 POC 可见化：JS 逐帧切图 + 预览卡 + 行为调参
- 用户反馈：雪碧图方案无拉伸 bug，但三花猫走路与改动前看不出区别。
- 根因：① WXSS `background-image` 引用 422KB 本地图，命中微信「本地图作 CSS 背景约 40KB 上限」，走路图层很可能空白；② 走路触发稀疏（约 15-20s 一次）、持续短（1-2s）、精灵小（132rpx），难以察觉。
- 方案：放弃 CSS `steps()` 雪碧图（留作后续多猫性能优化），改为 **JS 逐帧切 `<image src>`**：
  - `tools/build_walk_poc.py` 导出 12 张朝右小帧 → `assets/cats/calico-walk/00.png..11.png`（共约 439KB）；删除 `calico-walk-12.png`。
  - `index.js`：`WALK_FRAMES` + `startFrameLoop`（90ms）+ `tickWalkFrames` 定向更新走路猫 pose 与 `pocFrameSrc`。
  - 顶部 POC 预览卡（`pocWalkDemo:true`）持续循环展示走路帧，不依赖行为随机。
  - 行为：走路时长放慢 `min(3200, 1000+dist*55)`；三花猫 85% 优先在地面锚点间走动。
- 主包资源约 1.23MB。验收：进首页预览卡立即看到四肢循环；场景内三花猫较频繁慢走且腿在动。

### 阶段2 POC：走路序列帧管线跑通（三花猫）
- 目标：验证「切帧 → 对齐 → 拼雪碧图 → 压缩 → 小程序 steps() 播放」全管线（走路是最难动作，过则其余低风险）。
- 选材：`art-export/cats/calico/pounce-12.png`（三花猫，侧视朝左，12 帧潜行/走路），是手上唯一干净的横向走路循环。
- 关键修复：原始条 12 帧**竖向有漂移**（y_top 23→16→3，直接循环会跳）。`tools/build_walk_poc.py` 按内容包围盒**底部中心对齐**到统一 264×256 画布、水平居中（原地走，位移交给 transition），消除跳动。
- 产物：`miniprogram/assets/cats/calico-walk-12.png`（3168×256，量化压缩 422KB，主包 POC 用；正式 16 条仍按方案进分包）。主包资源 1.21MB。
- 接入（真实场景，仅三花猫）：`index.js` 新增 `WALK_SHEETS`，`buildCats` 在 `action==='walk' && 有序列帧` 时输出 `useSprite/walkSheet` 并清掉程序化颠簸 class；`index.wxml` 走路时渲染 `.cat-sprite>.cat-sheet`；`index.wxss` 用 `width:1200%` + `translateX(0→-100%)` + `steps(12)` 逐帧播放（纯几何位移，帧精确，避开 background-position 百分比坑）。其余猫/动作走静态姿势降级，不受影响。
- 验收方式：开发者工具看三花猫走动时是否腿动顺滑、无闪烁/瞬移/竖跳；其它猫仍静态。通过 → 阶段2 批量生产 4 猫×4 动作 + 进分包 + 防滑步对齐；不通过 → 退回静态多姿势保底（阶段1 成果不动）。
- 复现：`python tools/build_walk_poc.py`。
- ⚠️ 待观察：序列帧脚底基线在画布约 97% 处，而 `.cat-unit` 锚点用 translate(-50%,-78%)，走路时猫可能略微悬空（约 20rpx）；若明显，调 sprite 的对齐或 cat-unit 锚点比例。

### 修复：走路 POC 雪碧图在小程序中被拉伸
- 用户反馈：三花猫走路仍像直接平移，并伴随「三画面」异常拉伸。
- 原因：第一版用 `<image>` 渲染整条横向 strip，再靠 `width:1200% + transform` 裁剪；小程序 `image` 的 `mode` 与百分比宽高容易把整条图重新适配，导致裁剪窗口不稳定。
- 修复：改为 `<view class="cat-sprite">` 直接使用 `background-image`，固定单帧窗口 `132rpx × 128rpx`，`background-size:1200% 100%`，用 `background-position: 0→100%` + `steps(11)` 播放 12 帧。这样每一刻只露出一帧，不再把多帧横图拉伸进画面。

## 2026-06-15

### 重构：猫咖背景改为「烘焙整图」，修复裁切/错位/风扇 bug
- 问题（用户反馈）：① 方形 `cafe.jpg`(1280²) 在 9:16 竖屏卡片里被 `aspectFill` 裁掉两侧 → 背景显示不全；② 运行时叠加道具位置混乱、不贴地；③ 吊扇 PNG 含吊杆，旋转动画绕根部转 → 视觉 bug。
- 方案：放弃「空房间 + 运行时叠加道具」，改为用 `tools/compose_cafe.py` 把干净空房间 `art-export/cafe/room-bg.jpg` 扩成 1080×1920(9:16)，并按参考图 `img_v3...e6a8df8b.jpg` 布局把 咖啡师/吊扇/风铃/沙发/猫爬架/猫窝/毛线球 用 PIL **烘焙进背景整图**。顶部补天花、底部用干净木地板拉伸补地板。仅「猫」保持为运行时图层。
- 产物：`miniprogram/assets/cafe.jpg`（286KB，9:16）。
- `index.js`：`SCENES.cafe.props` 置空（道具已进背景，连带去掉吊扇旋转 bug）；锚点重定位到背景里烘焙家具的实际位置（沙发座/猫爬架顶+中/猫窝/地毯/3 个地面点）；`CAT_PROFILES` 默认落位对齐参考图（橘→沙发、灰缅因→爬架顶、黑→猫窝、三花→地毯）。
- 清理：删除 `miniprogram/assets/props/`（已烘焙，源图仍在 `art-export/props/`），主包资源降到约 0.8MB。
- 验收：用 PIL 预览（背景 + 4 猫姿势贴在锚点）确认四猫正确坐在对应家具上，已与参考图一致。
- 复现/再生成背景：`python tools/compose_cafe.py`（道具位置均为比例参数，便于微调）。
- ⚠️ 遗留：`courtyard.jpg` 仍是「带猫的参考原图」，进庭院场景会出现「烘焙猫 + 动态猫」双份；需后续用同样思路做一张干净庭院背景（缺干净的山石/石灯/水缸道具，较麻烦）。

### 场景道具组装 + 锚点绑定到家具（已被上一条取代）
- 背景图是「空房间」（吊扇/铃铛/风铃在源头已被移除），家具是独立透明 PNG，需要叠加组装——不是自动出现在背景里。
- `tools/export_stage1_assets.py` 增量导出 6 个道具（缩到 360px）进主包 `assets/props/`，主包总计约 1.29MB。
- `index.js`：SCENES.cafe 新增 `props`（猫爬架/沙发/猫窝/毛线球/吊扇/风铃，含 x/y/w/pin(bottom贴地|top吊挂)/z/anim）；新增 `buildProps()`，`refresh` 输出 `sceneProps`。
- 锚点改为「绑在家具上」：沙发座位、猫爬架顶/中层（high 层→跳跃）、猫窝、地面若干（floor）。猫的自主移动因此会走到/跳上这些家具。
- 深度排序：猫 z-index 按 y 动态计算（越靠下越靠前，选中 +400）；道具 z=2 在猫之下（猫显示为坐在家具上）；UI 浮层（profile/side-tools/status/panel）抬到 600+ 始终置顶。
- 氛围动画：吊扇旋转 `propSpin`、风铃摆动 `propSway`、毛线球轻晃 `propWobble`（keyframes 内携带 translate 以保持居中）。
- 待办：道具与锚点位置是按背景估算的，需在模拟器对照微调；courtyard 场景暂无专属道具。

### 阶段 1 落地：行为层 + 静态立绘程序化动画
- 接入素材：用 `tools/export_stage1_assets.py` 把 4 只猫静态立绘（缩到 256px）和猫咖背景导出进 `miniprogram/assets/`（cats/golden|black|calico|mainecoon.png + 覆盖 cafe.jpg），主包新增约 0.77MB，不触碰 2MB 限制。序列帧仍留在 art-export/，待阶段 2 分包接入。
- `index.js`：
  - SCENES 的 `points` 升级为 `anchors`（带 `layer: floor/high`）。CAT_PROFILES 增加 `pose`/`baseFacing`。
  - 行为层：`this.catRT`（运行时朝向/动作/时长）+ `this.catTimers`；`occupiedAnchors` 占位表保证不重叠、A 猫可去 B 猫腾空的位；`sendCatToAnchor` 按距离算时长、按层差判定走/跳、自动朝向；`microAction`（理毛/打盹/发呆）；`behaviorTick` 每 2.6s 只驱动空闲且未选中的猫；`startBehaviorLoop`/`clearBehaviorLoop` 在 onLoad/onShow/onHide/onUnload 管理。
  - 移动靠 CSS transition（位移）、跳跃/呼吸靠 keyframes，JS 每次决策只 setData 一次（`refreshCats` 仅更新 cats）。
- `index.wxml`：猫由 emoji 改为分层结构 `cat-unit(定位/位移) > cat-flip(朝向翻转) > cat-body(动作动画) > image(立绘)`；交互面板头像与祈愿仪式大图改用立绘。
- `index.wxss`：猫尺寸/位移过渡；catBreathe/catWalk/catJump/catGroom keyframes；朝向 scaleX 翻转；选中用 drop-shadow 高亮。
- 验收点：首页 4 只猫自主走动/跳到吧台/理毛打盹、互不重叠占位、可点选（含移动中）、选中暂停其自主行为、互动/祈愿期间不乱跑；切场景重置站位；存档兼容旧数据。
- 待阶段 2：序列帧动画（走路腿动等）替换静态立绘；锚点位置需在模拟器里对照背景微调。

### 美术资源处理：去背 + 切帧 + 道具提取
- 新增流水线脚本 `tools/process_art.py`（Pillow + numpy + scipy）。源图 `美术资源/` 全为 RGB（背景烘焙进像素），统一做「边缘连通浅色」去背加 alpha，并自动裁切。
- 猫咪精灵表按网格切帧，**每帧只保留最大连通块**，自动去掉序号(缅因猫1-16)/字母标签(金渐层A1-D6)/Meow气泡/Holopix水印；按公共包围盒对齐后输出横向 sprite strip（单帧高 256px）+ 单帧参考图。
- 产物：5 套猫 strip（calico/pounce-12、black/sleep-12、black-stand/stand-12、mainecoon/rest-16、golden 的 meow/tailwag/groom/sleepy 各 6 帧）、5 张静态定妆照、7 个道具（沙发/猫窝/猫爬架/毛线球/吊扇/风铃/咖啡师）、猫咖背景图（1280px JPG）。
- **存放在仓库根 `art-export/`，未进 `miniprogram/`**：全部产物约 8MB，远超主包 2MB 限制；保持现有 app 可编译。清单见 `art-export/美术资源清单.md`。接入动画系统时按分包/CDN 搬运。
- 关于「矢量图」：这些是细节插画（毛发/光影），矢量化无意义且不适合，统一用带透明通道的 PNG（背景图用 JPG）。

## 2026-06-12

### 决策：猫咪动画系统技术路线确认
- 路线：阶段 1（行为层 + 程序化动画）→ 阶段 2（扁平 2D 序列帧雪碧图，先 POC 再批量）→ 阶段 3（场景氛围动图）。
- 完整方案（任务分解 / 验收标准 / 素材规范 / AI 提示词模板 / 分工）：`docs/猫咪动画开发方案.md`。
- 关键依赖：① 第 1 只猫定妆照风格确认（启动依赖）；② 走路循环 POC（阶段 2 保险丝，失败则退回静态多姿势保底）。
- 状态：**待开发**，下一步是阶段 1 的锚点图 + 占位管理 + 行为状态机（可用 emoji 占位开发，不等素材）。

### 修复：首页场景一片空白
- 改动：`index.wxss` —— `.page` 由 `min-height: 100vh` 改为 `height: 100vh`；`.main` 增加 flex 列布局；`.view` 由 `height: 100%` 改为 `flex: 1`。
- 原因：场景卡片内全部是绝对定位元素，外层百分比高度无法基于 `min-height` 解析，高度塌缩为 0 后被 `overflow: hidden` 裁掉。
- 验收：首页能看到场景图、4 只猫、玩家卡片、右侧工具入口；图鉴/设置页可滚动。

### 修复：首页无法进入（卡在自检页）
- 改动：`app.json` 的 `pages` 注册 `pages/index/index` 并置为首项（此前只注册了 `pages/debug/debug`，redirectTo 必然失败）。
- 验收：编译后直接进入游戏首页。

### 功能：交互面板重构
- 点击面板外任意区域关闭面板：`scene-card` 绑定 `closeInteraction`，面板/猫咪/侧边工具改用 `catchtap` 阻止冒泡（`index.wxml` / `index.js`）。
- 猫咪信息（头像 emoji、Lv 等级、名称、状态）合并进交互面板顶部新增的 `panel-cat-row`；左上角 `profile-card` 固定展示玩家信息（`playerInfo.name` 目前是占位数据，接玩家系统时替换）。
- 状态气泡改为仅未选中猫时显示提示文案。
- 验收：点猫弹面板、点外部关闭、可直接点另一只猫切换选中。

### 结论：error_logs 分析
- `err_code 41001 access_token missing` / `Error: timeout` / link preload 警告均为开发者工具自身报错（测试号无 access_token 等），与业务代码无关，可忽略。

## 2026-06-12 之前（历史背景）

- 工程从浏览器静态原型（根目录 `index.html`/`app.js`，已停止维护）迁移为微信小程序工程 `miniprogram/`。
- 已有功能：双场景渲染、4 猫展示、点猫互动（抚摸/喂食/玩耍 + 每日上限）、成长值/等级、祈愿仪式与运势卡、图鉴三分栏（收藏/日历/场景）、设置页（改名/切场景/验收工具）。
- 详见 `README.md` 的功能清单与验收流程。
