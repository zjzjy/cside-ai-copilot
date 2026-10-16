BEGIN;

-- 旧 Mock/768 维向量无法转换为 BGE Large 的 1024 维语义向量，迁移后需重新导入知识。
UPDATE knowledge_vectors SET embedding = NULL WHERE embedding IS NOT NULL;
DROP INDEX IF EXISTS idx_knowledge_embedding;
ALTER TABLE knowledge_vectors
    ALTER COLUMN embedding TYPE vector(1024)
    USING NULL::vector(1024);
CREATE INDEX idx_knowledge_embedding ON knowledge_vectors
    USING hnsw (embedding vector_cosine_ops);
COMMENT ON COLUMN knowledge_vectors.embedding IS
    '1024维向量，bge-large-zh-v1.5 模型';

COMMIT;
