package com.cside.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cside.dto.KnowledgeChunk;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

class PromptBuilderTest {

    private final PromptBuilder promptBuilder = new PromptBuilder(
            new DefaultResourceLoader(), "classpath:prompts/five-step.txt");

    @Test
    void shouldInjectEveryPromptSection() {
        String prompt = promptBuilder.build(
                "vivo",
                "亲切、简洁，使用蓝心小V称呼",
                "七天无理由退货",
                "淘宝规则：不得引导站外交易",
                List.of("绝对最低价", "全网第一"),
                List.of(new KnowledgeChunk(
                        "faq-1",
                        "faq",
                        "brand",
                        "vivo",
                        "售后",
                        "耳机单边无声时先重置并重新配对",
                        0.98)),
                "耳机右边没声音怎么办？");

        assertThat(prompt)
                .contains("你是vivo品牌官方旗舰店的客服")
                .contains("蓝心小V")
                .contains("七天无理由退货")
                .contains("不得引导站外交易")
                .contains("绝对最低价、全网第一")
                .contains("[brand/售后] 耳机单边无声时先重置并重新配对")
                .contains("耳机右边没声音怎么办？")
                .contains("\"step1_intent\"")
                .doesNotContain("{brand}", "{rag}", "{customer_message}");
    }

    @Test
    void shouldRejectMissingRequiredContext() {
        assertThatThrownBy(() -> promptBuilder.build(
                        " ", "", "", "", List.of(), List.of(), "测试消息"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
