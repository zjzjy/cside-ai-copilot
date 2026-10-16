# Chrome Extension 开发记录

本文件只记录 `frontend/extension` 模块的实现、验证和未决项，不代表全仓发布日志。

## 2026-07-21 — 卡片 9–11 本地实现（未推送）

### 目标

- 在独立分支 `feature/chrome-extension-sidebar` 实现张洋负责的 Chrome Extension MVP。
- 不改后端、管理后台、数据目录和团队共享需求文档。
- 先使用 Mock 跑通侧边栏链路，等待后端 Swagger 稳定后再联调。

### 已实现

- Manifest V3、Side Panel、Background Service Worker 和 Content Script 多入口构建。
- 扩展图标点击打开 Side Panel；快捷键由 Manifest Commands 统一触发。
- 读取普通页面、`input` 和 `textarea` 中的选中文字。
- 支持淘宝/天猫、京东、拼多多、抖音域名识别，以及 `popstate`、`hashchange` 和 1 秒 URL 轮询。
- 使用 `tabState:<tabId>` 隔离标签页状态，并在标签页关闭后清理。
- 手动品牌/平台/店铺切换；切店时清空旧结果、收藏、错误和 `conversation_id`。
- 用请求序号和状态版本阻止旧生成/收藏请求在切店后写回新上下文。
- 输入内容变化时立即使旧生成请求失效；收藏始终保存对应生成结果的消息快照。
- 生成响应返回后核对品牌、平台与店铺 ID，不一致时拒绝展示结果。
- 空选区捕获会清空上一条客户消息；自动推断上下文未经人工确认时禁止生成。
- 标签页关闭清理与状态更新使用同一队列，避免异步写入在清理后重新留下客户文本。
- 五步 Mock 结果、加载骨架、失败重试、Step 3 复制、分步收藏和 500 字校验。
- Mock 字段和收藏 `step_type` 字符串类型与 `docs/api/README.md` 对齐。
- 新增域名边界和 Mock API 单元测试。

### 关键决策

- 使用仓库正式名称 `CSide`，没有沿用早期原型材料中的其他品牌名。
- 最低 Chrome 版本设为 116，因为实现使用 `chrome.sidePanel.open()`；共享 SRS 的“Chrome 90+”暂不修改。
- macOS 快捷键显式使用 `Command+Shift+F`；Windows 使用 `Ctrl+Shift+F`。
- 未识别页面默认保持品牌、平台和店铺未知，不静默默认成 vivo。
- 页面标题和店铺名关键词只用于候选提示，不把任意 URL 搜索词或未经映射的店铺 ID 当成可信品牌确认。
- 品牌、平台或店铺 ID 未确认时禁止生成，避免 Mock 或真实后端用错误默认值补全。
- 当前 UI 不允许在上下文不完整时发起生成；真实 API 类型仍按文档保留可选字段，等待 Swagger 联调确认。
- 真实 API 被限制在 `src/api/`，当前不提前发明降级状态、登录或会话接口。
- 权限保持为 `activeTab`、`clipboardWrite`、`sidePanel`、`storage` 和明确的电商域名；未申请完整 `tabs` 权限。
- ESLint / Prettier 配置放在扩展模块内并遵循团队分号等格式规则，避免改动根配置后连带格式化其他成员模块。

### 自动验证

验证环境：macOS。先在本机 Node `v24.16.0` 验证，再通过临时 Node `v20.19.5` 环境执行 `npm ci && npm run verify`；未修改系统 Node。团队 Node 20 LTS 要求已覆盖。

```text
npm run test   → 4 个测试文件、21 个测试全部通过
npm run lint   → Oxlint + ESLint 通过
npm run format:check → Prettier 格式检查通过
npm run build  → TypeScript + Vite 构建通过
npm run verify:dist → Manifest 引用与独立脚本检查通过
```

构建产物检查：

- `dist/manifest.json` 存在且为 Manifest V3。
- `dist/sidepanel.html`、`dist/background.js`、`dist/content.js` 均存在。
- Manifest 中引用的三个入口均能在 `dist/` 找到。
- `dist/content.js` 和 `dist/background.js` 未发现静态 `import`，没有悬空共享块。

本地界面预览：

- 在 Chrome 打开本机 Vite 预览，完成“未识别 → 手动选择 vivo/淘宝 → 输入消息 → 生成五步结果 → 收藏 Step 3”链路。
- 将 Chrome 窗口缩至约 500px 宽检查侧边栏布局，五步卡片、复制和收藏操作没有横向溢出。
- 复制按钮已触发；实际粘贴内容仍需在加载解压扩展后完成最终验收。

### 待完成的浏览器证据

- 在 Chrome 116+ 加载 `dist/` 并截图确认 Side Panel 打开。
- 在真实电商页面验证快捷键、选中文字和平台识别。
- 获取千牛/京麦真实 URL 与 iframe 样本，验证内部店铺 Tab 切换。
- 多标签页执行 vivo ↔ 华为切换，确认生成中切店也不会串结果。
- 验证剪贴板授权拒绝时的提示。
- 后端可用后按 Swagger 替换 Mock，并补登录 Token 与业务错误码映射。

### 协作边界

- 当前只有本地工作树改动，没有 commit、push、PR 或远程分支写入。
- `dev`、`master` 和其他成员的 feature 分支均未修改。

## 2026-07-23 — 远程接口复核与适配层解耦（未推送）

- 只读获取远程状态：`origin/dev` 已前进到 `1cde163`，新增登录、收藏、对话历史后端，未改动扩展目录。
- 当前远程 `dev` 尚无五步生成 Controller；收藏 DTO 使用 Java 驼峰字段，与 MVP 初始文档的下划线字段存在差异，因此暂不猜测真实生成/收藏适配。
- 后端默认端口 `9090` 与根 `.env.example` 的 `8080` 尚未统一；收藏接口在缺少有效数字对话 ID 时会回退到 vivo 店铺，存在串品牌风险，当前继续保持 Mock。
- 新增 `CustomerServiceApi` 统一入口和通用 `ApiError`，侧边栏不再直接依赖 `mock.ts`；Swagger 稳定后可只替换 API 适配器。
- 本地功能分支仍基于 `02ff63c`，没有合并、commit、push、PR 或远程分支写入。

## 2026-07-24 — 卡片 10 平台识别与 SPA 切店补强（未推送）

- 重新只读同步 `origin/dev`，远程仍停留在 `1cde163`，扩展目录没有团队改动。
- 将当前 `feature/chrome-extension-sidebar` 仅在本地快进到 `origin/dev@1cde163`；同步内容
  只涉及后端登录、收藏和对话历史模块，本地 `dev`、`master` 与远程分支均未修改。
- 补充抖店商家后台 `*.jinritemai.com` 的 Manifest 权限、Content Script 注入范围和
  `douyin` 平台识别，修复 `fxg.jinritemai.com` 被判为未知平台的问题。
- 将页面监听从“仅 URL 变化”补强为“URL 或页面标题变化”；千牛、京麦等 SPA 在 URL
  不变但标题随店铺切换时，也会重新发布候选店铺上下文。
- 新增页面快照变化测试，覆盖 URL 切换、仅标题切换和无变化去重。
- 分别使用本机 Node `v24.16.0` 和团队约定的临时 Node `v20.19.5` 执行完整验证：
  5 个测试文件、24 项测试全部通过，ESLint、Prettier、TypeScript/Vite 构建和产物入口
  检查均通过。
- 保留证据边界：如果真实平台内部切店时 URL 与标题均不变化，仍需真实页面样本后再增加
  平台专用 DOM 适配器；当前不猜测页面结构。
