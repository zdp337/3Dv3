# 单猫MVP · 项目记忆（AI 助手必读）

## 项目是什么

微信小程序「单猫MVP」：撸猫养成 + 每日祈愿玩法。场景整图（猫咖/古风庭院）上有 4 只猫，
玩家点击猫互动（抚摸/喂食/玩耍）积累成长值，每日可祈愿生成运势卡收录进图鉴。

## 工程结构与运行

- **有效代码在 `miniprogram/`**（微信小程序工程，`project.config.json` 的 miniprogramRoot 指向它）。
- 根目录的 `index.html` / `app.js` / `styles.css` 是早期浏览器静态原型，**仅作备份，不再维护**。
- `.codebuddy/` / `multi-agent-rules/` 是历史工具（CodeBuddy）的规则文件，Cursor 不读取，仅存档。
- 运行方式：微信开发者工具导入仓库根目录，点「编译」。AppID 当前为测试号（touristappid）。
- 核心文件：`miniprogram/pages/index/index.{wxml,wxss,js}`（首页/图鉴/设置全在这一个页面），
  `miniprogram/pages/debug/`（启动自检页），`miniprogram/assets/`（场景图）。

## 重要约定

- 状态持久化用 `wx.setStorageSync`，存储键 `single-cat-mini-state-v1`，结构见 `index.js` 的 `createInitialState()`。
- 渲染性能约定：禁止逐帧 setData；位移/动画一律走 WXSS transition/keyframes，JS 只下发一次目标状态。
- 美术素材全部由 AI 产出，风格已定为**扁平 2D**（纯色填充、干净描边）。猫素材统一侧视朝左，代码翻转实现朝右。
- 主包 ≤ 2MB；序列帧等大素材放分包。
- 开发者工具控制台里 `err_code 41001 access_token missing` 和 `Error: timeout`（堆栈在
  WAServiceMainContext.js）是工具自身报错，与业务代码无关，可忽略。

## 项目记忆的存放位置

- **开发记录**：`docs/DEVLOG.md`（倒序日志）。完成任何会改动代码的任务后必须在顶部追加条目。
- **当前最大的进行中事项**：猫咪动画系统，完整方案见 `docs/猫咪动画开发方案.md`（阶段 1→2→3 路线已确认）。
- 跨设备开发：聊天记录不随 git 同步，一切需要延续的上下文都要落到上述文件并提交。
