package com.cside.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class KnowledgeVectorRepositoryIntegrationTest {

    private static final String INSERT_SQL = """
        INSERT INTO knowledge_vectors (
            source_id, source_type, level, brand, platform, scene, content, embedding, metadata)
        VALUES (?, 'faq', ?, ?, ?, '售后', ?, CAST(? AS vector), CAST(? AS jsonb))
        """;

    private static final String UNIT_VECTOR = "["
            + String.join(",", Collections.nCopies(1024, "1"))
            + "]";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private KnowledgeVectorRepository repository;

    @BeforeEach
    void insertKnowledgeCandidates() {
        insert("IT-COMMON", "common", null, null, "通用耳机售后流程", "{}");
        insert("IT-VIVO", "brand", "vivo", null, "vivo耳机单边无声处理", "{}");
        insert("IT-HUAWEI", "brand", "华为", null, "华为耳机单边无声处理", "{}");
        insert(
                "IT-STORE",
                "store",
                "vivo",
                "taobao",
                "vivo淘宝店耳机换新活动",
                "{\"store_id\":\"store-1\"}");
        insert("IT-JD", "common", null, "jd", "京东平台耳机售后政策", "{}");
    }

    @Test
    void shouldApplyBrandPlatformAndStoreIsolationInDatabase() {
        List<String> sourceIds = repository.findCandidates(
                        "vivo", "taobao", "store-1", unitVector())
                .stream()
                .map(KnowledgeVectorCandidate::sourceId)
                .toList();

        assertThat(sourceIds)
                .contains("IT-COMMON", "IT-VIVO", "IT-STORE")
                .doesNotContain("IT-HUAWEI", "IT-JD");
    }

    @Test
    void shouldReadPgvectorAndBrandForbiddenWords() {
        KnowledgeVectorCandidate candidate = repository.findCandidates(
                        "vivo", "taobao", "store-1", unitVector())
                .stream()
                .filter(item -> item.sourceId().equals("IT-VIVO"))
                .findFirst()
                .orElseThrow();

        assertThat(candidate.vectorScore()).isEqualTo(1.0);
        assertThat(repository.findForbiddenWords("vivo"))
                .contains("保证不会坏", "永远不会降价");
        assertThat(repository.findForbiddenWords(null)).isEmpty();
    }

    @Test
    void shouldRejectEmbeddingWithWrongDimensions() {
        assertThatThrownBy(() -> repository.findCandidates(
                        "vivo", "taobao", "store-1", new float[767]))
                .isInstanceOf(InvalidDataAccessApiUsageException.class)
                .hasRootCauseInstanceOf(IllegalArgumentException.class)
                .rootCause()
                .hasMessageContaining("1024");
    }

    private void insert(
            String sourceId,
            String level,
            String brand,
            String platform,
            String content,
            String metadata) {
        jdbcTemplate.update(
                INSERT_SQL,
                sourceId,
                level,
                brand,
                platform,
                content,
                UNIT_VECTOR,
                metadata);
    }

    private static float[] unitVector() {
        float[] vector = new float[1024];
        java.util.Arrays.fill(vector, 1.0f);
        return vector;
    }
}
