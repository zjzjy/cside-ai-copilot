-- ============================================
-- CSide 数据库初始化 DDL
-- 数据库: PostgreSQL 17 + pgvector
-- ============================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'agent',   -- agent / admin
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.role IS 'agent=客服 / admin=管理员';

-- ============================================
-- 2. 品牌表
-- ============================================
CREATE TABLE brands (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,             -- vivo / huawei
    config      JSONB        NOT NULL DEFAULT '{}',       -- 话术风格、禁用语、保修政策等
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE brands IS '品牌表';
COMMENT ON COLUMN brands.config IS '话术风格、禁用语、保修政策等，详见 brand-config.json';

-- ============================================
-- 3. 店铺表
-- ============================================
CREATE TABLE stores (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,                -- vivo官方旗舰店-淘宝
    brand_id        BIGINT       NOT NULL REFERENCES brands(id),
    platform        VARCHAR(20)  NOT NULL,                -- taobao / jd / pdd / douyin
    url_pattern     VARCHAR(255),                         -- 用于URL自动识别店铺，如 %.taobao.com/%
    config          JSONB        NOT NULL DEFAULT '{}',   -- 店铺特有规则、促销活动等
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stores IS '店铺表';
COMMENT ON COLUMN stores.url_pattern IS '用于Content Script自动识别店铺';
COMMENT ON COLUMN stores.config IS '店铺特有促销活动、特殊规则等，继承品牌配置后覆盖';

-- ============================================
-- 4. 对话表
-- ============================================
CREATE TABLE conversations (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),    -- 哪个客服
    store_id    BIGINT       NOT NULL REFERENCES stores(id),   -- 哪个店铺的对话
    brand       VARCHAR(50)  NOT NULL,                         -- 冗余字段，加速检索
    platform    VARCHAR(20)  NOT NULL,                         -- 冗余字段，加速检索
    status      VARCHAR(20)  NOT NULL DEFAULT 'active',       -- active / archived
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE conversations IS '对话表（一个对话可包含多轮消息）';
COMMENT ON COLUMN conversations.status IS 'active=进行中 / archived=已归档';

-- ============================================
-- 5. 消息表
-- ============================================
CREATE TABLE messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(10)  NOT NULL,                    -- customer / agent
    content         TEXT         NOT NULL,
    metadata        JSONB        NOT NULL DEFAULT '{}',       -- {ai_generated: true, step_type: "3", ...}
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

COMMENT ON TABLE messages IS '消息表（每轮对话的具体内容）';
COMMENT ON COLUMN messages.role IS 'customer=客户消息 / agent=客服发送的话术';
COMMENT ON COLUMN messages.metadata IS '扩展字段：AI生成标记、收藏来源等';

-- ============================================
-- 6. 收藏表（数据飞轮基础）
-- ============================================
CREATE TABLE collections (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id),
    store_id            BIGINT       NOT NULL REFERENCES stores(id),
    brand               VARCHAR(50)  NOT NULL,                 -- 自动打标，不允许为空
    platform            VARCHAR(20)  NOT NULL,
    step_type           VARCHAR(10)  NOT NULL,                 -- 1~5 / full
    content             TEXT         NOT NULL,                  -- 话术文本
    customer_message    TEXT,                                   -- 触发收藏时的客户消息（便于构造微调问答对）
    conversation_id     BIGINT       REFERENCES conversations(id),
    tags                JSONB        NOT NULL DEFAULT '[]',    -- [意图类别, 场景, 情绪...]
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_brand ON collections(brand);
CREATE INDEX idx_collections_user  ON collections(user_id);

COMMENT ON TABLE collections IS '话术收藏表，收藏即进入微调初筛数据集';
COMMENT ON COLUMN collections.step_type IS '1=意图/2=策略/3=话术/4=钩子/5=收尾/full=整条五步';
COMMENT ON COLUMN collections.customer_message IS '触发收藏时的客户原始消息，后续微调构造 input→output 对';

-- ============================================
-- 7. 知识库向量存储表（RAG检索用）
-- ============================================
CREATE TABLE knowledge_vectors (
    id          BIGSERIAL PRIMARY KEY,
    source_id   VARCHAR(100) NOT NULL,                         -- 来源ID（FAQ ID / 话术ID / 商品SKU）
    source_type VARCHAR(30)  NOT NULL,                         -- faq / script / product / common_script
    level       VARCHAR(20)  NOT NULL DEFAULT 'brand',        -- common / brand / store
    brand       VARCHAR(50),                                   -- 品牌标签（通用层为空）
    platform    VARCHAR(20),
    category    VARCHAR(30),                                   -- 品类（手机/耳机/平板）
    scene       VARCHAR(50),                                   -- 场景标签
    content     TEXT         NOT NULL,                          -- 原始文本
    embedding   vector(1024),                                  -- bge-large-zh-v1.5: 1024维
    metadata    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 向量索引（HNSW 类型，检索更快）
CREATE INDEX idx_knowledge_embedding ON knowledge_vectors
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_knowledge_level ON knowledge_vectors(level);
CREATE INDEX idx_knowledge_brand ON knowledge_vectors(brand);
CREATE INDEX idx_knowledge_scene ON knowledge_vectors(scene);

COMMENT ON TABLE knowledge_vectors IS '知识库向量存储，RAG混合检索（BM25+向量）';
COMMENT ON COLUMN knowledge_vectors.embedding IS '1024维向量，bge-large-zh-v1.5 模型';

-- ============================================
-- 初始数据插入示例
-- ============================================

-- 品牌
INSERT INTO brands (name, config) VALUES
('vivo',  '{"tone":"专业科技感，亲切但不轻浮","style":"用数据和参数说话，但翻译成客户能听懂的语言。1英寸大底要说成进光量比普通手机多一倍，暗光拍照也清晰","forbidden_words":["保证不会坏","永远不会降价","绝对最低价","100%没问题","肯定能修好","一定不会出问题","全世界最好","秒杀所有手机","别的品牌都是垃圾"],"return_policy":"支持7天无理由退货（激活后不支持除外），15天内质量问题免费换新","warranty":{"phone":"12个月全国联保","accessory":"12个月（耳机、充电器等）","extended":"部分机型官旗赠送额外延保至18个月"}}'),
('huawei',  '{"tone":"专业沉稳，有技术底气但不傲慢","style":"强调自研技术和品质感，用技术语言但不傲慢","forbidden_words":["保证不会坏","永远不会降价","绝对最低价","100%没问题","鸿蒙比安卓好一万倍","华为自研无敌","其他品牌都是组装厂"],"return_policy":"支持7天无理由退货（激活后不支持除外），15天内质量问题免费换新","warranty":{"phone":"12个月全国联保","tablet":"12个月全国联保","accessory":"12个月"}}')
ON CONFLICT (name) DO UPDATE SET config = EXCLUDED.config;

-- 店铺
INSERT INTO stores (name, brand_id, platform, url_pattern) VALUES
('vivo官方旗舰店-淘宝', 1, 'taobao', '%.taobao.com%'),
('vivo官方旗舰店-京东', 1, 'jd',     '%.jd.com%'),
('华为官方旗舰店-淘宝', 2, 'taobao', '%.taobao.com%'),
('华为官方旗舰店-京东', 2, 'jd',     '%.jd.com%');
