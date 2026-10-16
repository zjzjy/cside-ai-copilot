# MVP 任务卡片

> 每个任务包含五要素：输入/输出/错误码/涉及文件/验收方式。
> 依赖关系已标注。无依赖 = 可用 mock 数据独立开发，不等人。
>
> API 格式来源：[docs/api/README.md](./api/README.md)
> 错误码来源：[docs/api/error-codes.md](./api/error-codes.md)

---

## 人员分配

```
1:Agent 设计 + 方案验证
  ├─ 定义 LLM / Embedding / RAG 接口 → 2 据此写 Mock 实现，不等人
  ├─ Prompt 模板设计 + LLM 输出质量测试
  └─ Embedding 方案评测 + RAG 检索方案验证

2：Agent 落地 + 后端架构
  ├─ 基础架构（Result/异常/CORS/Swagger/JWT骨架）
  ├─ MockLLMProvider + MockEmbeddingProvider → 让整条链路先跑通
  ├─ RAG检索实现 + 知识导入 + 五步生成 API + JSON 校验
  └─ 等 Embedding 选定 → 换上真实现；等 Prompt 定稿/同时调试 → 换上真模板

3：Chrome Extension 侧边栏
  ├─ Manifest V3 + Side Panel + Content Script
  └─ 五步结果面板 + 快捷键 + 店铺切换

4：后端业务
  ├─ JWT 登录 + 收藏 CRUD + 对话历史 API

5：前端管理后台
  └─ 品牌配置页 + 店铺配置页

6：数据 + 联调
  ├─ Docker 环境 + 建表 + 种子数据导入验证
  ├─ 评测数据集搭建
  └─ 前后端联调测试
```

---

## 1— Agent 设计 + 方案验证

### 卡片 1：接口定义 + Mock 契约

```
做什么:
  定义 Agent 核心 Java 接口 → 2 拿到后立刻写 Mock 实现，不等人

产出:
  backend/.../config/LLMProvider.java          ← String generate(String prompt)
  backend/.../config/EmbeddingProvider.java    ← float[] embed(String text)
  backend/.../service/RAGService.java          ← List<Chunk> search(String query, String brand)
  每个接口带 JavaDoc，注明输入约束和返回值约定

验收:
  2 看到接口和 JavaDoc → 不需要额外沟通即可开工
```

### 卡片 2：Prompt 模板设计 + LLM 验证

```
做什么:
  设计五步 Prompt 模板 → 调 LLM API → 验证 JSON 输出稳定性和话术质量

产出:
  ① Prompt 模板（含品牌话术风格注入、平台政策注入、RAG结果注入点）
  ② 5条测试用例（不同场景 x 不同品牌）的 LLM 输出结果
  ③ 输出稳定性报告：同一消息调 5 次，JSON 可解析率
  ④ 品牌风格验证：vivo 话术含"蔡司""OriginOS"等关键特征词，华为含"鸿蒙""麒麟"等

验收:
  同一条消息 → 连续调 5 次 → JSON 全部可解析，step1~5 全部非空
  vivo 和 华为 同一条消息 → 品牌话术风格明显不同
```

### 卡片 3：Embedding 方案验证

```
做什么:
  对比 2 个 Embedding API → 用种子数据建小向量库 → 测 Recall@5

产出:
  ① 评测笔记：千问 vs 智谱 → Recall@5 / 延迟 / 单次成本
  ② 10条 query 的检索结果（验证三级继承+品牌隔离）
  ③ 结论：MVP 用哪个

验收:
  10条 query → 每个 top-5 至少 3 条相关
  query="耳机不响了" brand=vivo → 返回 vivo FAQ+通用，不含华为内容
  query="耳机不响了" brand=华为 → 返回华为 FAQ+通用，不含vivo内容
```

---

## 2— Agent 落地 + 后端架构

### 2 的 Mock 优先策略

```
2 只等1的接口定义（卡片1，半天）。拿到后立刻写 Mock 实现，
用假数据把整条链路跑通。1的卡片2/3 完成后，换上真实现。

具体节奏:
  D1 上午:  等接口 → 下午开始写 Mock
  D1 下午:  基础架构 + MockLLMProvider + MockEmbeddingProvider
  D2:       RAG 骨架（BM25 先跑）+ 五步 API 骨架 + 知识导入的存储部分
  D2-D3:    真 Embedding + 真 LLM 换上去（1的卡片2/3 陆续交付）
```

### 卡片 4：后端基础架构

```
功能:
  - 统一响应格式 Result<T> { code, message, data }
  - 全局异常处理 @ControllerAdvice
  - JWT 认证过滤器（骨架，token 解析逻辑等 P3 的登录接口）
  - SpringDoc Swagger 配置
  - CORS 配置（允许 extension 跨域请求）

涉及文件:
  backend/.../config/Result.java
  backend/.../config/GlobalExceptionHandler.java
  backend/.../config/JwtAuthFilter.java
  backend/.../config/SwaggerConfig.java
  backend/.../config/CorsConfig.java

依赖: 无
验收: 启动后端 → /swagger-ui.html 可见 → 抛异常返回 {"code":9999,"message":"..."}
```

### 卡片 5：Mock LLM + Mock Embedding

```
功能:
  MockLLMProvider: 不调 API，返回一段写死的五步 JSON（模拟正常 LLM 输出）
  MockEmbeddingProvider: 不调 API，返回随机 768 维浮点数组

涉及文件:
  backend/.../config/MockLLMProvider.java
  backend/.../config/MockEmbeddingProvider.java

依赖: 1的卡片1 (接口定义)
验收: 注入 Mock → 五步 API 返回假数据 → 链路跑通
```

### 卡片 6：知识库导入脚本

```
功能:
  从 data/seed/ 读 JSON → 调 EmbeddingProvider → INSERT INTO knowledge_vectors

涉及文件:
  backend/.../service/KnowledgeImportService.java

依赖: 1的卡片1 (接口), 卡片5 (Mock 阶段可用随机向量占位)
验收: 执行导入 → SELECT COUNT(*) FROM knowledge_vectors → 约 60+ 条
```

### 卡片 7：RAG 检索服务

```
功能:
  - 混合检索（BM25 + pgvector 余弦相似度）
  - 三级继承排序（店铺 > 品牌 > 通用）
  - 品牌禁用语过滤

涉及文件:
  backend/.../service/RAGService.java
  backend/.../repository/KnowledgeVectorRepository.java

依赖: 卡片6 (知识库有数据), 1的卡片3结论 (真Embedding实现参数)
验收:
  query="耳机不响了" brand=vivo → top-5 含 vivo FAQ+通用，无华为
```

### 卡片 8：五步生成 API

```
接口: POST /api/v1/generate
请求: { customer_message, conversation_id?, brand?, platform?, store_id? }
响应: { code, message, data: { conversation_id, brand, platform, five_step: {...} } }
错误码: 2001(LLM失败), 2002(格式异常), 3002(消息为空), 3003(超500字)

内部流程:
  客户消息 → RAG检索 → 拼Prompt → LLM生成 → JSON解析+校验 → 存对话/消息 → 返回

涉及文件:
  backend/.../controller/GenerateController.java
  backend/.../service/GenerateService.java
  backend/.../service/PromptBuilder.java          ← Prompt 模板（你的卡片2定稿后替换）
  backend/.../dto/GenerateRequest.java, GenerateResponse.java

依赖: 卡片7 (RAG检索)
验收: curl POST /generate → 五步 JSON 完整 → step3 含品牌话术风格
```

---

## 2— Chrome Extension 侧边栏

### 卡片 9：Chrome Extension 骨架

```
功能: Manifest V3 + Side Panel + Content Script 基础通信
涉及文件:
  frontend/extension/public/manifest.json
  frontend/extension/src/sidepanel/
  frontend/extension/src/content/
  frontend/extension/src/background/
依赖: 无
验收: 加载扩展 → 点击图标 → 侧边栏打开
```

### 卡片 10：Content Script — 文本选中 + 快捷键 + URL 监听

```
功能:
  - Ctrl+Shift+F → 获取页面选中文本 → 发给 Side Panel
  - 监听 URL 变化 → 识别域名(taobao/jd/pdd/douyin) → 发给 Side Panel

涉及文件:
  frontend/extension/src/content/index.ts
  frontend/extension/src/content/urlWatcher.ts

依赖: 卡片9
验收:
  选中文字 → Ctrl+Shift+F → 侧边栏收到
  打开 taobao.com → 侧边栏显示"淘宝"
  千牛切换店铺Tab → 侧边栏标识跟着变
```

### 卡片 11：五步结果面板 + 店铺切换

```
功能:
  - 调用生成 API（先用 mock） → 展示五步面板
  - 骨架屏 / 错误提示 / 重试
  - 一键复制 Step3
  - 分步收藏 ⭐
  - 店铺下拉菜单（手动切换品牌+平台+店铺）

涉及文件:
  frontend/extension/src/sidepanel/GeneratePanel.tsx
  frontend/extension/src/sidepanel/StoreSwitcher.tsx
  frontend/extension/src/api/mock.ts

依赖: 卡片9, 卡片10
验收:
  输入消息 → 生成 → 五步面板 → 复制 → 粘贴验证 → 点⭐收藏
  下拉切换 vivo→华为 → 侧边栏标识更新
```

---

## 4— 后端业务

### 卡片 12：JWT 登录

```
接口: POST /api/v1/auth/login
请求: { username, password }
响应: { code:0, data: { token, username, role } }
错误码: 1001(参数为空), 1002(密码错误)

涉及文件:
  backend/.../controller/AuthController.java
  backend/.../service/AuthService.java
  backend/.../config/JwtUtil.java
  backend/.../entity/User.java
  backend/.../repository/UserRepository.java

依赖: 卡片4 (JwtAuthFilter 骨架)
验收: curl POST /login → 拿 token → 带 token 调其他接口 → 通过
```

### 卡片 13：收藏 API

```
接口:
  POST /api/v1/collections   请求: { step_type, content, conversation_id?, customer_message? }
  GET  /api/v1/collections   参数: brand?, step_type?, page, size

收录逻辑: 从 generate 返回的五步中点⭐ → 自动填 step_type+content → 后端从上下文补全 brand/platform/store_id

涉及文件:
  backend/.../controller/CollectionController.java
  backend/.../service/CollectionService.java
  backend/.../entity/Collection.java  (brand 字段 NOT NULL)

依赖: 卡片12
验收: POST 收藏 → GET /collections → 列表有 → brand 自动填充
```

### 卡片 14：对话历史 API

```
接口: GET /api/v1/conversations/{id}
响应: { id, brand, platform, store_id, messages: [...], created_at }

涉及文件:
  backend/.../controller/ConversationController.java
  backend/.../service/ConversationService.java
  backend/.../entity/Conversation.java
  backend/.../entity/Message.java

依赖: 卡片12
验收: 调 generate 生成对话 → GET /conversations/{id} → 看到消息列表
```

---

## 5— 前端管理后台

### 卡片 15：管理后台骨架 + 品牌配置

```
功能: React SPA → 左侧菜单 → 品牌列表 → 编辑话术风格+禁用语 → 保存

涉及文件:
  frontend/admin/src/App.tsx
  frontend/admin/src/layout/
  frontend/admin/src/pages/BrandConfig.tsx

依赖: 无
验收: npm run dev → 看到管理后台 → 编辑 vivo 禁用语 → 保存 → 刷新后生效
```

### 卡片 16：店铺配置

```
功能: 店铺列表 → 编辑 URL 识别模式 + 促销活动 → 保存

涉及文件:
  frontend/admin/src/pages/StoreConfig.tsx

依赖: 卡片15 (管理后台骨架)
验收: 进入页面 → 看到4个店铺 → 编辑促销活动 → 保存 → 刷新后生效
```

---

## 6— 数据 + 联调

### 卡片 17：Docker 环境 + 建表 + 种子数据验证

```
功能:
  - docker compose up 启动 PostgreSQL + Redis
  - 执行 schema.sql 建表
  - 验证 data/seed/ 下所有 JSON 可正常解析
  - 执行知识导入脚本 → 验证 knowledge_vectors 表有数据

涉及文件:
  docker/docker-compose.yml  (已有)
  data/schema.sql            (已有)
  data/seed/ 下所有 JSON      (已有)

依赖: 无
验收:
  docker compose up -d → psql \dt 看到 7 张表 → 种子数据可解析 → 导入后数据量正确
```

### 卡片 18：评测数据集搭建

```
功能:
  - 从现有 Mock_Data 整理意图分类标注集（50条）
  - 标记检索评测用的 query-doc 对

涉及目录:
  data/eval/

依赖: 无
验收: data/eval/ 下存在标注好的测试集 JSON 文件
```

### 卡片 19：端到端联调测试

```
功能:
  - P1 五步 API 好了 → P2 侧边栏接上 → 你测试完整链路
  - 记录联调中发现的接口不一致、字段遗漏等问题
  - 验证品牌隔离端到端（vivo消息生成的回复不能含有华为特征词）
  - 准备 Demo 验收环境

依赖: 2的卡片8 + 3的卡片11 (这两样好了才开始)
验收: CS选中客户消息 → 快捷键 → 五步展示 → 复制 → 发送的完整闭环
```

---

## 依赖关系速查

```
1的卡片1 (接口, 半天) ──→ 2 卡片5 (Mock, 当天下午开工)
                                  ↓
2 卡片4 (基础架构) ──────────→ 4 卡片12 (登录)

2 卡片5+6+7 ────────────────→ 2 卡片8 (五步API)

3 卡片9 → 卡片10 → 卡片11    ← 全部前端 mock，不等人

5 卡片15 → 卡片16             ← 纯前端，不等人

6 卡片17                      ← 无依赖，第一天就能做
6 卡片18                      ← 无依赖
6 卡片19                      ← 等 2卡片8 + 3卡片11
```

**并行策略：** Day 1 上午1写完接口后，2/3/4/5/6 全部可以同时开工，互不阻塞。联调在 Day 3-4。

---

## MVP 验收清单

```
□ 五步生成: curl POST /generate → 完整 JSON → 品牌话术风格正确
□ 品牌隔离: vivo 查询不出华为内容，反之亦然
□ 侧边栏: 选中消息 → 快捷键 → 五步面板 → 复制 → 收藏
□ 登录: curl POST /login → token → 调受保护接口通过
□ 收藏: POST 收藏 → GET /collections → brand 字段自动填充
□ 管理后台: 修改禁用语 → 生成的话术中该词被过滤
□ 环境: docker compose up 一键启动全部服务
□ 端到端: CS 在千牛 → 选中客户消息 → 快捷键 → 侧边栏出话术 → 点复制 → 粘贴发送
```
