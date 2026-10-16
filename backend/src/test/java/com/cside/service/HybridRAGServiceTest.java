package com.cside.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cside.config.EmbeddingProvider;
import com.cside.dto.KnowledgeChunk;
import com.cside.repository.KnowledgeVectorCandidate;
import com.cside.repository.KnowledgeVectorRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HybridRAGServiceTest {

    private KnowledgeVectorRepository repository;
    private HybridRAGService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeVectorRepository.class);
        EmbeddingProvider embeddingProvider = text -> {
            float[] embedding = new float[1024];
            java.util.Arrays.fill(embedding, 1.0f);
            return embedding;
        };
        service = new HybridRAGService(
                embeddingProvider, repository, "为这个句子生成表示以用于检索相关文章：");
    }

    @Test
    void shouldCombineRetrievalAndEnforceBrandIsolationAndForbiddenWords() {
        when(repository.findForbiddenWords("vivo")).thenReturn(List.of("绝对最低价"));
        when(repository.findCandidates(
                        eq("vivo"), eq("taobao"), eq("store-1"), any(float[].class)))
                .thenReturn(List.of(
                candidate("vivo-faq", "brand", "vivo", "耳机单边不响，可重置后重新配对"),
                candidate("common-script", "common", null, "耳机故障请先致歉并登记售后检测"),
                candidate("huawei-faq", "brand", "华为", "耳机单边不响，使用鸿蒙重新连接"),
                candidate("forbidden", "brand", "vivo", "这是绝对最低价，请立刻下单"),
                candidate("unrelated-1", "brand", "vivo", "手机支持无线充电"),
                candidate("unrelated-2", "common", null, "订单将在四十八小时内发货"),
                candidate("unrelated-3", "common", null, "支持申请电子发票"),
                candidate("unrelated-4", "common", null, "欢迎光临旗舰店")));

        List<KnowledgeChunk> results = service.search(
                "耳机不响了", "vivo", "taobao", "store-1");

        assertThat(results).hasSize(5);
        assertThat(results.getFirst().sourceId()).isEqualTo("vivo-faq");
        assertThat(results).extracting(KnowledgeChunk::sourceId)
                .contains("common-script")
                .doesNotContain("huawei-faq", "forbidden");
        assertThat(results).allMatch(chunk -> chunk.brand() == null
                || chunk.brand().equalsIgnoreCase("vivo"));
        assertThat(results).allMatch(chunk -> chunk.score() >= 0.0 && chunk.score() <= 1.0);
    }

    @Test
    void shouldReturnOnlyCommonKnowledgeWithoutBrand() {
        when(repository.findForbiddenWords(null)).thenReturn(List.of());
        when(repository.findCandidates(
                        isNull(), isNull(), isNull(), any(float[].class)))
                .thenReturn(List.of(
                candidate("common", "common", null, "通用耳机售后规则"),
                candidate("brand", "brand", "vivo", "vivo耳机售后规则")));

        List<KnowledgeChunk> results = service.search("耳机售后", null, null, null);

        assertThat(results).extracting(KnowledgeChunk::sourceId).containsExactly("common");
    }

    @Test
    void shouldNotReturnVivoKnowledgeForHuaweiRequest() {
        when(repository.findForbiddenWords("华为")).thenReturn(List.of());
        when(repository.findCandidates(
                        eq("华为"), eq("jd"), isNull(), any(float[].class)))
                .thenReturn(List.of(
                        candidate("huawei-faq", "brand", "华为", "华为耳机单边不响处理"),
                        candidate("vivo-faq", "brand", "vivo", "vivo耳机单边不响处理"),
                        candidate("common", "common", null, "通用耳机故障处理")));

        List<KnowledgeChunk> results = service.search("耳机不响", "华为", "jd", null);

        assertThat(results).extracting(KnowledgeChunk::sourceId)
                .contains("huawei-faq", "common")
                .doesNotContain("vivo-faq");
    }

    @Test
    void shouldPreferStoreThenBrandThenCommonForEquivalentKnowledge() {
        when(repository.findForbiddenWords("vivo")).thenReturn(List.of());
        when(repository.findCandidates(
                        eq("vivo"), eq("taobao"), eq("store-1"), any(float[].class)))
                .thenReturn(List.of(
                candidate("common", "common", null, "耳机售后处理"),
                candidate("brand", "brand", "vivo", "耳机售后处理"),
                candidate("store", "store", "vivo", "耳机售后处理")));

        List<KnowledgeChunk> results = service.search(
                "耳机售后处理", "vivo", "taobao", "store-1");

        assertThat(results).extracting(KnowledgeChunk::sourceId)
                .containsExactly("store", "brand", "common");
    }

    @Test
    void shouldRejectBlankQuery() {
        assertThatThrownBy(() -> service.search(" ", "vivo", null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static KnowledgeVectorCandidate candidate(
            String sourceId, String level, String brand, String content) {
        return new KnowledgeVectorCandidate(
                sourceId,
                "faq",
                level,
                brand,
                "售后",
                content,
                1.0);
    }
}
