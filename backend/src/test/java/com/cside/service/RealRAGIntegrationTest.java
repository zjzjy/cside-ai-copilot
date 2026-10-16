package com.cside.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cside.config.EmbeddingProvider;
import com.cside.dto.KnowledgeChunk;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class RealRAGIntegrationTest {

    private static final String TEST_BRAND = "rag-live-test";

    @Autowired
    private EmbeddingProvider embeddingProvider;

    @Autowired
    private RAGService ragService;

    @Autowired
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Value("${RAG_INTEGRATION_TEST_ENABLED:false}")
    private boolean enabled;

    @Test
    void shouldRetrieveWithRealBgeAndPgvector() {
        Assumptions.assumeTrue(enabled);
        jdbcTemplate.update(
                """
                INSERT INTO brands (name, config)
                VALUES (:brand, CAST('{"forbidden_words":["绝对最低价"]}' AS jsonb))
                ON CONFLICT (name) DO UPDATE SET config = EXCLUDED.config
                """,
                Map.of("brand", TEST_BRAND));
        insert("live-brand", "brand", TEST_BRAND, "耳机右边没有声音时，请放回充电盒重置并重新配对");
        insert("live-common", "common", null, "耳机单边无声属于常见连接故障，可先进行设备重置");
        insert("live-other-brand", "brand", "another-brand", "耳机右边没有声音时联系其他品牌售后");
        insert("live-forbidden", "brand", TEST_BRAND, "这是绝对最低价，请立刻下单购买");

        List<KnowledgeChunk> results =
                ragService.search("耳机右边没有声音", TEST_BRAND, "taobao", null);

        assertThat(results).extracting(KnowledgeChunk::sourceId)
                .contains("live-brand", "live-common")
                .doesNotContain("live-other-brand", "live-forbidden");
        assertThat(results).allMatch(chunk ->
                chunk.brand() == null || TEST_BRAND.equalsIgnoreCase(chunk.brand()));
    }

    private void insert(String sourceId, String level, String brand, String content) {
        float[] embedding = embeddingProvider.embed(content);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("sourceId", sourceId);
        parameters.put("level", level);
        parameters.put("brand", brand);
        parameters.put("content", content);
        parameters.put("embedding", toPgVector(embedding));
        jdbcTemplate.update(
                """
                INSERT INTO knowledge_vectors
                    (source_id, source_type, level, brand, platform, scene, content, embedding)
                VALUES
                    (:sourceId, 'faq', :level, :brand, 'taobao', '售后', :content,
                     CAST(:embedding AS vector))
                """,
                parameters);
    }

    private static String toPgVector(float[] values) {
        StringBuilder result = new StringBuilder(values.length * 8).append('[');
        for (int index = 0; index < values.length; index++) {
            if (index > 0) {
                result.append(',');
            }
            result.append(values[index]);
        }
        return result.append(']').toString();
    }
}
