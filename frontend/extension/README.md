# CSide Chrome Extension

CSide 的浏览器侧边栏前端，负责 MVP 任务卡 9–11：打开 Side Panel、接收页面选中文字、识别当前平台/店铺上下文，并通过 Mock API 展示五步客服建议。

当前实现坚持“AI 辅助、人工发送”：扩展不会自动读取完整聊天记录，也不会自动向客户发送任何内容。

## 代码实现状态（不等于真实浏览器验收）

- 🧩 已编码：Manifest V3 + Chrome Side Panel + Background + Content Script
- 🧩 已编码：Windows `Ctrl+Shift+F` / macOS `Command+Shift+F` 获取当前页面选中文字
- 🧩 已编码：淘宝/天猫、京东、拼多多、抖音/抖店域名识别与 SPA URL、页面标题轮询
- 🧩 已编码：按标签页隔离选中文字和店铺上下文，避免多店铺串线
- 🧩 已编码：手动品牌、平台、店铺切换兜底
- 🧩 已编码：Mock 五步生成、加载骨架、错误重试、Step 3 复制、分步收藏
- 🧩 已编码：500 字输入校验与 API 文档错误码模拟
- 🧪 已自动验证：24 项单元测试、ESLint / Prettier、构建和产物入口检查
- ⏳ 待现场验收：在 Chrome 116+ 加载解压扩展，验证真实页面快捷键、剪贴板和多标签页隔离
- ⏳ 待联调：真实后端、登录 Token、千牛/京麦真实 URL 样本和 iframe 场景

## 环境要求

- Node.js 20.19+（团队约定使用 Node 20 LTS）
- npm
- Chrome 116+（代码使用 `chrome.sidePanel.open()`）

> 仓库 SRS 中的“Chrome 90+”与 Side Panel API 的真实要求不一致。本模块按当前实现所需的 Chrome 116+ 执行，未修改共享 SRS。

## 安装与检查

```bash
cd frontend/extension
npm ci
npm run verify
```

构建完成后，Chrome 实际加载的是 `frontend/extension/dist/`，不是源码目录，也不是 Vite 开发服务器地址。

## 在 Chrome 加载

1. 打开 `chrome://extensions`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本目录下的 `dist/`。
5. 固定 CSide 扩展，点击图标，确认右侧栏打开。
6. 修改代码后重新执行 `npm run build`，再在扩展管理页点击“重新加载”，并刷新业务页面。

`npm run dev` 只适合快速预览侧边栏 React 界面；Chrome Side Panel、快捷键、Content Script 和 Background 必须通过构建后的 `dist/` 验收。

## MVP 手动验收

### 卡片 9：扩展骨架

- 加载 `dist/` 后无 Manifest 错误。
- 点击扩展图标能打开侧边栏。
- Side Panel 和 Service Worker 的 DevTools 无报错。

### 卡片 10：选中文字与上下文

- 在支持页面选中文字，按 Windows `Ctrl+Shift+F` 或 macOS `Command+Shift+F`。
- 侧边栏打开，并显示选中的文字。
- 打开淘宝/天猫页面时平台显示“淘宝 / 天猫”；打开抖店
  `fxg.jinritemai.com` 时平台显示“抖音”。
- 在 URL 不变但页面标题随店铺变化的 SPA 中，侧边栏重新发布候选店铺上下文。
- 在不同品牌标签页之间切换，确认文字、店铺和生成结果不会串到另一个标签页。
- 自动识别不足时使用品牌、平台、店铺下拉框手动选择。
- 自动识别只作提示；品牌、平台或店铺 ID 未经人工确认时，生成按钮保持禁用，避免使用错误品牌上下文。

### 卡片 11：五步结果

- 输入消息后点击“生成五步建议”，依次看到骨架屏和五步结果。
- 点击“复制推荐话术”，粘贴到临时文本框核对内容。
- 五个步骤可以分别收藏，重复点击不会重复提交。
- 输入 `#mock-error`，确认出现错误提示并可重试。
- 输入 501 个字符，确认按钮禁用并显示超限提示。
- 生成过程中切换店铺或标签页，旧请求结果不能写回新店铺。
- 生成过程中修改输入框，旧请求结果不能覆盖新输入。
- 从 vivo 切换到华为后，旧结果、收藏状态和 `conversation_id` 均被清空。

## 目录结构

```text
frontend/extension/
├── public/manifest.json       # Manifest V3、权限、快捷键和注入域名
├── sidepanel.html             # Chrome Side Panel 入口
├── src/
│   ├── background/            # 打开侧栏、快捷键协调、按 tab 保存状态
│   ├── content/               # 选中文字、平台/店铺识别、URL 变化监听
│   ├── sidepanel/             # React 侧边栏界面
│   ├── api/                    # 统一 API 适配层；MVP 默认使用 Mock
│   └── shared/                # 消息协议与数据类型
└── HISTORY.md                 # 本模块的开发记录与验证证据
```

## 消息链路

```text
Manifest 快捷键
  → Background 打开当前窗口 Side Panel
  → Background 向活动标签页发送 CAPTURE_SELECTION
  → Content Script 读取选中文字
  → Background 按 tabId 写入 chrome.storage.session
  → TAB_STATE_UPDATED 通知 Side Panel
```

Background 是跨上下文的唯一协调者。每个标签页使用独立的 `tabState:<tabId>`，关闭标签页时清理，避免 vivo、华为等不同店铺之间串数据。

## Mock API 契约

字段名称以 `docs/api/README.md` 为初始准绳：

- 真实 API 文档：`customer_message`、`conversation_id?`、`brand?`、`platform?`、`store_id?`
- 当前 UI / Mock 安全约束：生成前必须确认 `brand`、`platform`、`store_id`，缺一项返回 `1001`，不自动补默认店铺
- 生成响应：`conversation_id`、`brand`、`platform`、`store_id`、`five_step`
- 收藏请求：`step_type`（字符串 `"1"`–`"5"`）、`content`、`conversation_id?`、`customer_message?`

侧边栏只依赖 `CustomerServiceApi`，不直接引用 Mock 或拼接真实请求。接入真实后端后，以 Swagger 为唯一事实源；即使后端字段保持可选，前端仍保留完整店铺上下文校验，并在统一 API Adapter 中处理字段映射、Bearer Token 和业务响应 `code`。

## 已知边界

- 当前平台识别有单元测试，但真实千牛、京麦、拼多多和抖店页面尚未现场验证。
- 已同时监听 SPA URL 和页面标题；如果内部店铺 Tab 切换时二者都不变化，仍需要真实页面
  样本决定是否增加平台适配器或 DOM 观察，手动切换始终保留。
- 页面标题只用于尽力识别品牌/店铺名称；没有明确 `storeId` 时，不应把推断结果当成已确认的真实店铺 ID。
- 当前没有可信的“真实店铺 ID → 品牌”配置，因此所有自动推断上下文都必须经手动店铺选择后才能生成。
- Content Script 产物必须保持为不含静态 `import` 的独立 `content.js`。新增运行时共享依赖后必须重新检查构建产物。
- 当前未实现完整登录、多轮会话、最近活跃对话、真实收藏列表、RAG、OCR、CLIP 或图片消息。

详细开发过程见 [HISTORY.md](./HISTORY.md)。
