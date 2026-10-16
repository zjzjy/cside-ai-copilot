package com.cside;

import static org.assertj.core.api.Assertions.assertThat;

import com.cside.config.EmbeddingProvider;
import com.cside.config.LLMProvider;
import com.cside.service.RAGService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CsideApplicationTests {

    @Autowired
    private LLMProvider llmProvider;

    @Autowired
    private EmbeddingProvider embeddingProvider;

    @Autowired
    private RAGService ragService;

    @Test
    void contextLoadsWithRealProvidersAndRagService() {
        assertThat(llmProvider.getClass().getSimpleName()).isEqualTo("FallbackLLMProvider");
        assertThat(embeddingProvider.getClass().getSimpleName())
                .isEqualTo("TeiEmbeddingProvider");
        assertThat(ragService.getClass().getSimpleName()).isEqualTo("HybridRAGService");
    }

}
