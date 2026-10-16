# 开发指南

> 新成员加入项目后第一件事就是读这个文件。这里是所有协作约定的唯一来源。
---

## 环境搭建

### 你需要装什么

| 工具           | 版本       | 验证命令             |
| -------------- | ---------- | -------------------- |
| JDK            | 21         | `java -version`    |
| Node.js        | 20 LTS     | `node -v`          |
| Docker Desktop | 最新稳定版 | `docker --version` |
| npm            | Node.js 自带 | `npm -v` |

### 第一次跑起来

```bash
# 1. 克隆仓库
git clone <repo-url>
cd cside

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 LLM API Key（DeepSeek 或 Qwen 至少填一个）
# .env 由 springboot4-dotenv 自动加载，无需额外配置

# 3. 启动基础设施（PostgreSQL + Redis + TEI Embedding）
cd docker
docker compose up -d

# 4. 初始化数据库
docker exec -i cside-db psql -U cside -d cside < ../data/schema.sql

# 5. 启动后端
cd ../backend
./mvnw spring-boot:run

# 6. 导入知识库（后端启动后执行一次）
curl -X POST http://localhost:8181/api/v1/knowledge/import \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:8181/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)"

# 7. 启动前端（新开终端）
cd ../frontend/extension
npm install
npm run dev
```

### Embedding 模式切换

项目支持两种 Embedding 方案，通过 `.env` 中的 `EMBEDDING_PROVIDER` 一键切换，无需改代码。

```bash
# .env 中修改这一行即可：
EMBEDDING_PROVIDER=qwen   # 云端模式
EMBEDDING_PROVIDER=tei    # 本地模式
```

| | Qwen 云端 | TEI 本地 |
|---|---|---|
| **实现类** | `QwenEmbeddingProvider` | `TeiEmbeddingProvider` |
| **模型** | text-embedding-v3 | bge-large-zh-v1.5 |
| **维度** | 1024 | 1024 |
| **前置条件** | `LLM_QWEN_API_KEY` 已填写 | Docker 容器 `cside-embeddings` 运行中 |
| **启动耗时** | 即时 | 模型预热 ~6 分钟（仅首次，后续缓存） |
| **网络** | 需要 VPN（DashScope API） | 无需（纯本地推理） |
| **费用** | API 按量计费 | 免费（CPU 推理） |
| **适用场景** | 快速开发测试 | 生产部署、离线环境 |

**切换机制**：两个 Provider 都实现了 `EmbeddingProvider` 接口，通过 `@ConditionalOnProperty(name = "cside.embedding.provider", havingValue = "qwen|tei")` 实现自动装配。改完 `.env` 重启后端即生效。

**实现文件**：`backend/.../config/EmbeddingProvider.java`（接口 + TeiEmbeddingProvider + QwenEmbeddingProvider 在同一文件）

> **注意**：LLM API（DeepSeek/Qwen）在国内直连可能超时，需要 VPN。

---

## 分支规则

```
master        保护分支，不允许直接 push
  └─ dev      日常集成分支，所有人从这里拉新分支
       ├─ feature/<功能名>    新功能开发
       └─ fix/<问题名>        bug 修复
```

**规则：**

- **永远不要直接 push 到 master 或 dev**
- 每次开发前：`git checkout dev` → `git pull` → `git checkout -b feature/你的功能名`
- 开发完成后提 Pull Request，合并到 dev
- master 只从 dev 合并，且必须通过 PR

---

## 版本号规则

用语义化版本（Semantic Versioning）：`主版本.次版本.修订号`

```
V0.1.0  → MVP 开发阶段，一切从 0 开始
V0.2.0  → 次要功能完成
V0.1.1  → 修了个 bug
V1.0.0  → MVP 正式发布
```

每次发版在仓库里打一个 Tag，方便回溯：

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Commit 规范

每个 commit 只做一件事。格式：

```
<type>: <简短中文描述>
```

| type         | 什么时候用               |
| ------------ | ------------------------ |
| `feat`     | 新增功能                 |
| `fix`      | 修复 bug                 |
| `docs`     | 改了文档                 |
| `refactor` | 重构代码，不改变行为     |
| `chore`    | 杂活（改配置、装依赖等） |
| `test`     | 加了测试                 |

**示例：**

```
feat: 五步生成API第一版
fix: 修复侧边栏店铺切换不跟随
docs: 更新API错误码表
chore: 添加ESLint配置
```

---

## 代码风格

### 前端（TypeScript + React）

**安装依赖：**

```bash
# 在 frontend/extension 和 frontend/admin 目录下各执行一次
npm install -D eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Prettier 配置：** 项目根目录放 `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

**ESLint 配置：** 项目根目录放 `.eslintrc.cjs`（用 Airbnb 或 recommended 配置作为起点）

**package.json 脚本：**

```json
{
  "scripts": {
    "lint": "eslint src/ --fix",
    "format": "prettier --write src/"
  }
}
```

提交前跑一下：

```bash
npm run lint      # ESLint 检查
npm run format    # Prettier 格式化
```

### 后端（Java）

项目根目录放 `checkstyle.xml`（用 [Google Java Style](https://checkstyle.sourceforge.io/google_style.html)），在 `pom.xml` 中配置 `maven-checkstyle-plugin`。编译时自动检查，不通过不让打包。

本地手动跑：

```bash
./mvnw checkstyle:check
```

### 通用约定

- 变量/函数/类名用英文，不用拼音
- 注释用中文（除非你英文比中文好）
- 不要提交注释掉的代码——删了就删了，git 历史里找得到
- 不要提交 `console.log` / `System.out.println`

---

## Pull Request

### 提 PR 之前

- [ ] 代码在本地能跑通
- [ ] lint 检查通过
- [ ] 没有冲突（如果有，先在本地 `git merge dev` 解决）
- [ ] commit 信息符合上面的规范

### PR 怎么写

- **标题**：`feat: 做了什么`，一句话说清楚
- **描述**：写三样东西：
  1. 改了什么
  2. 为什么这么改
  3. 怎么验证它是对的（截图 / 终端输出 / 测试结果）

### 合并规则

- 至少 **1 个人 approve** 才能合并
- **合并按钮由 PR 发起人自己点**（不是 reviewer 点）
- 合并后删除 feature 分支

---

## API 约定

### RESTful

```
GET    /api/v1/conversations          查询
POST   /api/v1/conversations          新建
PUT    /api/v1/conversations/{id}     更新
DELETE /api/v1/conversations/{id}     删除
```

### 响应格式

所有接口统一返回：

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

错误码表见 `docs/api/error-codes.md`。

### 接口文档

后端用 SpringDoc OpenAPI 自动生成。启动后端后访问：`http://localhost:8080/swagger-ui.html`

**前端对接口时直接看 Swagger 页面，不要对着别的文档猜。**

---

## 环境变量

- `.env.example` 是模板，提交到仓库，包含所有可配置变量及默认值
- `.env` 是真实值，**绝不提交**，已加入 `.gitignore`
- 加载方式：`springboot4-dotenv`（`me.paulschwarz:springboot4-dotenv`）在启动时自动读取项目根目录 `.env` 并注入 Spring Environment
- `application.yml` 通过 `${VAR}` 引用 `.env` 中的变量，关键配置项 `springdotenv.export-to-system-properties: true` 确保早期解析
- 新增变量时同步更新 `.env.example`（只写 key 和注释，不写真实值）
- **依赖**：`springboot4-dotenv` 已加入 `pom.xml`，队友 clone 后 `./mvnw compile` 即自动下载

---

## 目录约定

```
不要往这些地方放东西：
  backend/src/main/resources/  → 只放配置文件，不写 Java 代码
  frontend/*/public/           → 只放静态资源（favicon、manifest 等）
  data/                        → 只放数据文件（JSON/CSV/Markdown），不放代码

必须放的地方：
  后端代码    → backend/src/main/java/com/cside/
  后端测试    → backend/src/test/java/com/cside/
  前端代码    → frontend/extension/src/ 或 frontend/admin/src/
  文档        → docs/
  数据库脚本  → data/seed/
  评测数据    → data/eval/
  Docker 相关 → docker/
```

---

## 遇到问题

1. 先翻这个文件
2. 再翻 `docs/` 下的文档
3. 看 `git log` 最近谁改的相关代码，直接问那个人
4. 都不行，群里问
