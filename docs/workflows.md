# CSide 系统流程文档

> V1.1 | 2026-07-25
>
> 新增: 品牌/店铺配置编辑, 管理后台 SPA, E2E 测试体系, RAG 溯源展示, 一键启动/安装脚本

---

## 流程总览

```
┌─────────────────────────────────────────────────────┐
│                    CSide 系统                        │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐ │
│  │ 客服侧边栏 │    │ 管理后台  │    │ 后端服务       │ │
│  │ (Extension)│    │ (Admin)  │    │ (Spring Boot) │ │
│  └─────┬─────┘    └────┬─────┘    └───────┬───────┘ │
│        │               │                  │         │
│        └───────┬───────┘                  │         │
│                │                          │         │
│         HTTP API (:8181)                  │         │
│                │                          │         │
│        ┌───────┴───────┐         ┌───────┴───────┐ │
│        │  PostgreSQL    │         │   DeepSeek     │ │
│        │  + pgvector    │         │   LLM API      │ │
│        └───────────────┘         └───────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 流程一：客服 AI 话术生成（核心链路）

### 入口
- 客服在浏览器侧边栏（Chrome Side Panel）中输入客户消息
- 或选中电商平台（淘宝/京东/拼多多/抖音）页面中的客户消息文本，按 `Ctrl+Shift+F`

### 完整流程

```
① 客服输入客户消息
   └─ 输入 "耳机左边不响了，用了三个月，能换新吗？"
   └─ 选择品牌+平台+店铺（如 vivo / 淘宝 / vivo旗舰店）

② 扩展调用后端 API
   └─ POST /api/v1/generate { customerMessage, brand, platform, storeId }
   └─ JWT 认证（扩展自动注入 token）

③ 后端处理链路
   ├─ 用户认证 → JWT 解析
   ├─ 品牌解析 → 加载品牌 config（tone, style, forbidden_words, warranty）
   ├─ 店铺解析 → 匹配店铺
   ├─ 平台政策 → 加载平台退货政策
   ├─ RAG 检索 → pgvector 向量检索知识库
   │   ├─ 商品知识库（SKU 精确匹配 + 语义检索）
   │   ├─ 政策规则库（BM25 + 向量混合检索）
   │   ├─ FAQ 语料库（语义检索）
   │   └─ 话术模板库（标签过滤 + 语义检索）
   ├─ Prompt 构建 → 系统指令 + RAG 上下文 + 品牌风格 + 禁用语 + 客户消息
   ├─ LLM 调用 → DeepSeek V4 Flash（主）→ Qwen3.5 Plus（备）→ 混元（兜底）
   ├─ JSON 校验 → 五步完整性检查（step3 必须 >=20字）
   └─ 数据库写入 → conversation + messages（含 RAG 溯源信息）

④ 返回五步结果给扩展
   ├─ Step1 意图识别 — "客户咨询耳机左耳故障，使用三个月..."
   ├─ Step2 回复策略 — "先安抚客户，明确告知在保修期内..."
   ├─ Step3 推荐话术 — "亲，才用了三个月肯定在保修期内！vivo耳机保12个月..."
   ├─ Step4 钩子引导 — "顺便问一下，您这个耳机有没有配合保护套使用呀？..."
   └─ Step5 成功收尾 — "感谢理解～工单已生成..."

⑤ 扩展展示
   ├─ 五步结果卡片（每步独立展示）
   ├─ RAG 溯源 Top-3（知识来源 + 匹配分数）
   ├─ 一键复制推荐话术（Step3）
   ├─ 分步收藏（⭐ 按钮，存入个人话术库）
   └─ 级联修改（修改任一步 → 下游自动重生成）
```

### 数据流向
| 阶段 | 输入 | 输出 | 存储 |
|------|------|------|------|
| 认证 | JWT Token | 用户身份 | `users` 表 |
| 品牌解析 | brand 名称 | 品牌 config JSON | `brands.config` (JSONB) |
| RAG 检索 | 客户消息 + 品牌/平台/店铺 | Top-5 知识块 | `knowledge_chunks` (pgvector) |
| Prompt 构建 | 所有上下文 | 完整 Prompt 文本 | 无持久化 |
| LLM 调用 | Prompt | 五步 JSON | 无持久化 |
| 结果存储 | 客户消息 + AI 话术 | conversation_id | `conversations` + `messages` 表 |
| 话术收藏 | 步骤类型 + 话术文本 | collection_id | `collections` 表 |

---

## 流程二：管理后台 — 品牌配置

### 入口
- 浏览器打开 `http://localhost:5173`
- 登录 admin / admin123
- 左侧菜单 → 品牌配置

### 完整流程

```
① 查看品牌列表
   └─ GET /api/v1/brands → 返回所有品牌的 config

② 点击「编辑」→ Modal 表单弹出
   ├─ 话术基调 (tone) — "专业科技感，亲切但不轻浮"
   ├─ 话术风格 (style) — "用数据和参数说话..."
   ├─ 禁用语 (forbidden_words) — Tag 输入 ["保证不会坏", "永远不会降价", ...]
   ├─ 退货政策 (return_policy) — "支持7天无理由退货..."
   └─ 保修条款 (warranty) — phone: "12个月全国联保", accessory: "12个月"

③ 保存
   └─ PUT /api/v1/brands/{id} → config JSONB 全量替换
   └─ 写入 PostgreSQL brands.config

④ 生效
   └─ 客服下次触发话术生成时，Prompt 自动包含最新的品牌风格和禁用语
```

---

## 流程三：管理后台 — 店铺配置

### 入口
- 左侧菜单 → 店铺配置

### 完整流程

```
① 查看店铺列表
   └─ GET /api/v1/stores → 返回所有店铺（含关联品牌名）

② 点击「编辑」→ Modal 表单弹出
   ├─ 店铺名称 (name) — "vivo官方旗舰店-淘宝"
   ├─ URL 识别模式 (urlPattern) — "%.taobao.com%"
   ├─ 促销活动 (promotions) — 动态列表
   │   ├─ 活动名称、有效期
   │   ├─ 活动规则（每行一条）
   │   └─ 备注
   └─ 特殊规则 (special_rules) — 键值对列表
       ├─ extended_return: "本店支持15天无理由退货"
       └─ after_sales_hours: "客服在线时间 8:00-24:00"

③ 保存
   └─ PUT /api/v1/stores/{id}
   └─ 写入 PostgreSQL stores 表（name, url_pattern, config JSONB）
```

---

## 流程四：话术收藏

### 入口
- 侧边栏五步结果中，每步旁边有 ⭐ 收藏按钮

### 完整流程

```
① 点击 ⭐
   └─ 可收藏五步中任意一步（不限于整条）

② 调用后端
   └─ POST /api/v1/collections { stepType, content, conversationId, customerMessage }
   └─ 系统自动打标签：brand, platform, store_id, 意图分类

③ 存储
   └─ 写入 PostgreSQL collections 表
   └─ 收藏即进入微调初筛数据集（数据飞轮）

④ 查看
   └─ GET /api/v1/collections → 按品牌/步骤/关键词筛选
```

---

## 流程五：店铺上下文自动识别

### 入口
- 客服在电商后台（千牛/京麦/抖店）工作时

### 完整流程

```
① Content Script 监听页面
   ├─ 页面加载时 → 解析 URL 识别平台和店铺
   │   └─ taobao.com → 淘宝, jd.com → 京东, pdd → 拼多多, douyin → 抖音
   └─ 定时轮询 URL/标题变化（1s 间隔）

② 发布 PAGE_CONTEXT_CHANGED 消息
   └─ Content Script → Background Service Worker

③ Background 管理 Tab 状态
   └─ chrome.storage.session { tabState:<tabId> }
   └─ 自动检测 vs 手动选择不互相覆盖

④ Side Panel 接收并展示
   └─ TAB_STATE_UPDATED → 更新品牌/平台/店铺显示
   └─ 自动切换到该店铺的最近活跃对话
```

---

## API 端点总览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/login` | POST | JWT 登录 |
| `/api/v1/generate` | POST | AI 五步话术生成 |
| `/api/v1/collections` | GET/POST | 收藏列表 / 新增收藏 |
| `/api/v1/conversations/{id}` | GET | 对话历史详情 |
| `/api/v1/brands` | GET | 品牌配置列表 |
| `/api/v1/brands/{id}` | GET/PUT | 品牌配置详情 / 编辑 |
| `/api/v1/stores` | GET | 店铺配置列表 |
| `/api/v1/stores/{id}` | GET/PUT | 店铺配置详情 / 编辑 |

---

## 技术架构

- **后端**: Spring Boot 4.0.3 + JDK 21 + Maven
- **前端 (扩展)**: React 19 + TypeScript + Vite + Chrome Extension Manifest V3
- **前端 (管理后台)**: React 19 + TypeScript + Vite + Ant Design 5
- **数据库**: PostgreSQL 16 + pgvector
- **缓存**: Redis 7
- **LLM**: DeepSeek V4 Flash → Qwen3.5 Plus → 混元 Hy3（降级链）
- **Embedding**: BAAI/bge-large-zh-v1.5 (1024维, Hugging Face TEI)
- **部署**: Docker Compose（数据库层）+ 裸进程（应用层）

---

## 流程六：开发与测试

### 一键启动

```
双击项目根目录 start.bat
  ├─ 检查 Docker 容器 (PostgreSQL + Redis)
  ├─ 如未启动则自动 docker compose up -d
  ├─ 等待 PostgreSQL 就绪
  ├─ 启动后端 (:8181)
  ├─ 等待后端就绪
  ├─ 启动管理后台 (:5173)
  └─ 打印访问地址
```

### 一键安装

```
双击项目根目录 setup.bat
  ├─ 检查 Docker Desktop 是否安装
  ├─ 检查 JDK 21 是否安装
  ├─ 检查 Node.js 18+ 是否安装
  ├─ docker compose up -d (PostgreSQL + Redis)
  ├─ 初始化数据库表结构 (data/schema.sql)
  ├─ npm install (admin + extension)
  ├─ 构建 Chrome 扩展 (dist/)
  └─ 创建 .env 配置文件模板
```

### 测试体系 (46 个测试)

```
frontend/extension/
  ├─ 单元测试 (Vitest)
  │   npm test                          → 24 tests
  │   覆盖: Mock API, URL 检测, Tab 状态, Context 校验, Gate 模式
  │
  ├─ 组件 E2E (Playwright + Mock API)
  │   npm run test:e2e:component        → 14 tests
  │   覆盖: 下拉联动, 字符计数, 生成流程, 骨架屏,
  │         错误重试, 复制, 收藏, Toast
  │
  └─ 完整链路 E2E (Playwright + 加载扩展)
      npm run build && npm run test:e2e:full  → 8 tests
      覆盖: 扩展加载, Service Worker, 侧边栏 UI,
            Background 状态管理, Content Script 通信
```

### 扩展开发模式

```
Mock 模式 (默认): 扩展内置 Mock API (650ms 返回假数据)
  适合前端开发, 无需后端

真实 API 模式: 扩展调用 http://localhost:8181
  切换方法: 在侧边栏控制台执行:
    await fetch('http://localhost:8181/api/v1/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username:'admin',password:'admin123'})
    }).then(r=>r.json()).then(d=>{
      localStorage.setItem('cside_token', d.data.token)
      localStorage.setItem('cside_use_real_api', 'true')
      location.reload()
    })
  然后输入客户消息 → 点生成 → ~12s 后看到 DeepSeek 生成的五步话术
  侧边栏底部显示 RAG 检索到的知识来源 Top-3（如商品参数、保修条款、FAQ）
```

### 关键依赖版本

| 依赖 | 版本要求 | 检查方式 |
|------|----------|----------|
| Docker Desktop | 最新稳定版 | `docker --version` |
| JDK | 21 (Eclipse Temurin) | `java -version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Maven Wrapper | 项目内置 (./mvnw) | 无需安装 |
| PostgreSQL | 16 + pgvector 0.7+ | Docker 内置 |
| Redis | 7 | Docker 内置 |

### 新增功能 (V1.1)

| 功能 | 说明 |
|------|------|
| 品牌配置编辑 | 管理后台 Modal 表单编辑 tone/style/forbidden_words/return_policy/warranty |
| 店铺配置编辑 | 管理后台 Modal 表单编辑 name/urlPattern/promotions/special_rules |
| 管理后台 SPA | Ant Design 5 布局 + 侧边栏菜单 + JWT 登录 |
| RAG 溯源展示 | 侧边栏五步结果底部显示检索到的 Top-3 知识来源 |
| E2E 测试体系 | Playwright 完整链路测试 (加载扩展 + Content Script + Background) |
| 一键启动脚本 | start.bat 自动启动 Docker + 后端 + 管理后台 |
| 一键安装脚本 | setup.bat 检查依赖 + 安装 + 初始化 |
