package com.cside.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSourceUtils;
import org.springframework.stereotype.Repository;

/**
 * knowledge_vectors 的只读检索仓库。
 */
@Repository
public class KnowledgeVectorRepository {

    private static final int CANDIDATE_LIMIT = 200;

    private static final String FIND_CANDIDATES_SQL = """
        SELECT source_id,
               source_type,
               level,
               brand,
               scene,
               content,
               CASE
                   WHEN embedding IS NULL THEN 0.0
                   ELSE GREATEST(
                       0.0,
                       LEAST(1.0, 1.0 - (embedding <=> CAST(:queryEmbedding AS vector)) / 2.0))
               END AS vector_score
          FROM knowledge_vectors
         WHERE (
                   level = 'common'
                OR (level = 'brand' AND LOWER(brand) = LOWER(:brand))
                OR (level = 'store'
                    AND LOWER(brand) = LOWER(:brand)
                    AND metadata ->> 'store_id' = :storeId)
               )
           AND (platform IS NULL OR :platform = '' OR LOWER(platform) = LOWER(:platform))
         ORDER BY vector_score DESC
         LIMIT :candidateLimit
        """;

    private static final String FIND_FORBIDDEN_WORDS_SQL = """
        SELECT jsonb_array_elements_text(
                   COALESCE(config -> 'forbidden_words', '[]'::jsonb)) AS forbidden_word
          FROM brands
         WHERE LOWER(name) = LOWER(:brand)
        """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final int embeddingDimensions;

    public KnowledgeVectorRepository(
            NamedParameterJdbcTemplate jdbcTemplate,
            @Value("${cside.embedding.dimensions:1024}") int embeddingDimensions) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingDimensions = embeddingDimensions;
    }

    /**
     * 查询通用层及与上下文严格匹配的品牌、店铺层候选，数据库层完成品牌隔离。
     *
     * @param brand 当前品牌；空值只返回通用层
     * @param platform 当前平台；空值不限制平台
     * @param storeId 当前店铺 ID；空值不返回店铺层
     * @param queryEmbedding 与当前 Embedding 模型和 pgvector 列维数一致的查询向量
     * @return 最多 200 条候选，包含由 pgvector 计算的归一化余弦相似度
     */
    public List<KnowledgeVectorCandidate> findCandidates(
            String brand, String platform, String storeId, float[] queryEmbedding) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("brand", valueOrEmpty(brand));
        parameters.put("platform", valueOrEmpty(platform));
        parameters.put("storeId", valueOrEmpty(storeId));
        parameters.put("queryEmbedding", toPgVector(queryEmbedding));
        parameters.put("candidateLimit", CANDIDATE_LIMIT);
        return jdbcTemplate.query(FIND_CANDIDATES_SQL, parameters, this::mapCandidate);
    }

    /**
     * 读取品牌配置中的禁用语。
     *
     * @param brand 当前品牌；空值返回空列表
     * @return 品牌禁用语列表
     */
    public List<String> findForbiddenWords(String brand) {
        if (brand == null || brand.isBlank()) {
            return List.of();
        }
        return jdbcTemplate.queryForList(
                FIND_FORBIDDEN_WORDS_SQL,
                Map.of("brand", brand.trim()),
                String.class);
    }

    private KnowledgeVectorCandidate mapCandidate(ResultSet resultSet, int rowNumber)
            throws SQLException {
        return new KnowledgeVectorCandidate(
                resultSet.getString("source_id"),
                resultSet.getString("source_type"),
                resultSet.getString("level"),
                resultSet.getString("brand"),
                resultSet.getString("scene"),
                resultSet.getString("content"),
                resultSet.getDouble("vector_score"));
    }

    private static String valueOrEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    public boolean existsBySourceId(String sourceId) {
        String sql = "SELECT COUNT(*) FROM knowledge_vectors WHERE source_id = :sourceId";
        Integer count = jdbcTemplate.queryForObject(
                sql, Map.of("sourceId", sourceId), Integer.class);
        return count != null && count > 0;
    }

    public void batchInsertKnowledge(List<KnowledgeVectorInsert> items) {
        String sql = """
            INSERT INTO knowledge_vectors
                (source_id, source_type, level, brand, platform, category, scene, content, embedding, metadata)
            VALUES
                (:sourceId, :sourceType, :level, :brand, :platform, :category, :scene, :content, :embedding::vector, :metadata::jsonb)
            """;
        List<Map<String, Object>> batchParams = new ArrayList<>();
        for (KnowledgeVectorInsert item : items) {
            Map<String, Object> params = new HashMap<>();
            params.put("sourceId", item.sourceId());
            params.put("sourceType", item.sourceType());
            params.put("level", item.level());
            params.put("brand", item.brand());
            params.put("platform", item.platform());
            params.put("category", item.category());
            params.put("scene", item.scene());
            params.put("content", item.content());
            params.put("embedding", item.embedding() != null ? toPgVector(item.embedding()) : null);
            params.put("metadata", item.metadataJson());
            batchParams.add(params);
        }
        jdbcTemplate.batchUpdate(sql, batchParams.toArray(new Map[0]));
    }

    private String toPgVector(float[] embedding) {
        if (embedding == null || embedding.length != embeddingDimensions) {
            throw new IllegalArgumentException(
                    "query embedding must contain " + embeddingDimensions + " dimensions");
        }
        StringBuilder vector = new StringBuilder(embedding.length * 8).append('[');
        for (int index = 0; index < embedding.length; index++) {
            if (index > 0) {
                vector.append(',');
            }
            vector.append(embedding[index]);
        }
        return vector.append(']').toString();
    }
}
