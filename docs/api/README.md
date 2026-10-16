# API 接口文档

> MVP 阶段只覆盖核心链路的 5 个接口。后续接口由前端按需提出，后端边做边加。
>
> 在线文档：启动后端后访问 `http://localhost:8080/swagger-ui.html`

---

## 通用约定

### 基础路径

```
/api/v1/
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

### 认证

除登录接口外，所有接口需在 Header 中携带 Token：

```
Authorization: Bearer <token>
```

### 错误码

详见 [error-codes.md](./error-codes.md)

---

## MVP 接口清单（5 个）

### 1. 登录

```
POST /api/v1/auth/login
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| username | string | ✅ | 用户名 |
| password | string | ✅ | 密码 |

**响应 data：**

```json
{
  "token": "eyJhbGciOi...",
  "username": "zhangsan",
  "role": "agent"
}
```

---

### 2. 生成五步话术

```
POST /api/v1/generate
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| customer_message | string | ✅ | 客户消息文本，≤500字 |
| conversation_id | string | ❌ | 对话ID，不传则新建对话 |
| brand | string | ❌ | 品牌，不传则系统自动识别 |
| platform | string | ❌ | 平台，不传则系统自动识别 |
| store_id | string | ❌ | 店铺ID，不传则系统自动识别 |

**响应 data：**

```json
{
  "conversation_id": "conv_001",
  "brand": "vivo",
  "platform": "taobao",
  "store_id": "store_001",
  "five_step": {
    "step1_intent": "售后-质量问题，客户反馈耳机单边不响...",
    "step2_strategy": "先致歉安抚情绪，告知保修政策，提供换新方案...",
    "step3_script": "亲，非常抱歉给您带来不好的体验...",
    "step4_hook": "这边帮您看一下同系列的升级款哦~",
    "step5_close": "换新申请已提交，预计3天内发货..."
  }
}
```

---

### 3. 收藏话术

```
POST /api/v1/collections
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| step_type | string | ✅ | 1-5 或 "full"（整条五步） |
| content | string | ✅ | 话术文本 |
| conversation_id | string | ❌ | 来源对话ID |
| customer_message | string | ❌ | 触发时的客户消息（便于后续微调构造问答对） |

> 收藏时系统自动从当前上下文打标签：brand / platform / store_id / 意图分类。客服无需手动填。

**响应 data：**

```json
{
  "id": "col_001",
  "created_at": "2026-07-19T15:30:00Z"
}
```

---

### 4. 查询收藏列表

```
GET /api/v1/collections
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| brand | string | ❌ | 按品牌筛选 |
| step_type | string | ❌ | 按步骤筛选（1-5 或 "full"） |
| keyword | string | ❌ | 关键词搜索 |
| page | int | ❌ | 页码，默认 1 |
| size | int | ❌ | 每页条数，默认 20 |

**响应 data：**

```json
{
  "list": [
    {
      "id": "col_001",
      "step_type": "3",
      "content": "亲，非常抱歉给您带来不好的体验...",
      "brand": "vivo",
      "platform": "taobao",
      "store_id": "store_001",
      "tags": ["售后", "质量问题", "安抚"],
      "customer_message": "耳机左边不响了",
      "created_at": "2026-07-19T15:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

---

### 5. 查询对话历史

```
GET /api/v1/conversations/{id}
```

**响应 data：**

```json
{
  "id": "conv_001",
  "brand": "vivo",
  "platform": "taobao",
  "store_id": "store_001",
  "status": "active",
  "messages": [
    { "role": "customer", "content": "耳机左边不响了，用了三个月", "time": "2026-07-19T14:28:00Z" },
    { "role": "agent", "content": "亲，非常抱歉给您带来不好的体验...", "time": "2026-07-19T14:32:00Z" },
    { "role": "customer", "content": "那能换吗？", "time": "2026-07-19T14:35:00Z" }
  ],
  "created_at": "2026-07-19T14:28:00Z"
}
```

---

## 接口文档怎么更新

1. **后端加新接口** → 在 Controller 上加 SpringDoc 注解，Swagger 页面自动更新
2. **前端需要新接口** → 群里喊一声，后端当场加
3. **字段有变** → 后端改代码 → Swagger 自动同步 → 前端看新文档对接口

**不要手工维护接口文档。Swagger 页面是唯一真相来源。** 本文档仅用于 MVP 初期对齐，后续以 Swagger 为准。
