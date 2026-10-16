package com.cside.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.cside.dto.KnowledgeChunk;
import com.cside.service.PromptBuilder;
import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class RealProviderIntegrationTest {

    @Autowired
    private LLMProvider llmProvider;

    @Autowired
    private EmbeddingProvider embeddingProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PromptBuilder promptBuilder;

    @Value("${LLM_INTEGRATION_TEST_ENABLED:false}")
    private boolean llmTestEnabled;

    @Value("${EMBEDDING_INTEGRATION_TEST_ENABLED:false}")
    private boolean embeddingTestEnabled;

    @Test
    void shouldCallRealDeepSeekAndReturnFiveStepJson() throws Exception {
        Assumptions.assumeTrue(llmTestEnabled);

        String prompt = promptBuilder.build(
                "vivo",
                "亲切、专业、简洁",
                "符合条件的商品支持七天无理由退货",
                "淘宝平台内沟通，不引导站外交易",
                List.of("绝对最低价"),
                List.of(new KnowledgeChunk(
                        "faq-1",
                        "faq",
                        "brand",
                        "vivo",
                        "售后",
                        "耳机单边无声时先放回充电盒重置并重新配对",
                        0.98)),
                "耳机右边没有声音怎么办？");
        String response = llmProvider.generate(prompt);
        JsonNode json = objectMapper.readTree(response);

        assertThat(json.path("step1_intent").asText()).isNotBlank();
        assertThat(json.path("step2_strategy").asText()).isNotBlank();
        assertThat(json.path("step3_script").asText()).isNotBlank();
        assertThat(json.path("step4_hook").asText()).isNotBlank();
        assertThat(json.path("step5_close").asText()).isNotBlank();
    }

    @Test
    void shouldCallDockerBgeAndReturn1024Dimensions() {
        Assumptions.assumeTrue(embeddingTestEnabled);

        float[] embedding = embeddingProvider.embed("耳机右边没有声音");

        assertThat(embedding).hasSize(1024);
        for (float value : embedding) {
            assertThat(value).isFinite();
        }
    }
}
