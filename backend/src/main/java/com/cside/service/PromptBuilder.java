package com.cside.service;

import com.cside.dto.KnowledgeChunk;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

/** 从可替换模板构建五步客服 Prompt。 */
@Service
public class PromptBuilder {

    private final String template;

    public PromptBuilder(
            ResourceLoader resourceLoader,
            @Value("${cside.prompt.template:classpath:prompts/five-step.txt}")
                    String templateLocation) {
        Resource resource = resourceLoader.getResource(templateLocation);
        try (var input = resource.getInputStream()) {
            this.template = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("cannot load prompt template: " + templateLocation, exception);
        }
    }

    /**
     * 注入品牌、平台、禁用语、RAG 结果和客户消息。
     *
     * @param brand 品牌名
     * @param voice 品牌话术风格
     * @param returnPolicy 品牌退货政策
     * @param platform 平台规则
     * @param forbiddenWords 禁用语
     * @param ragChunks RAG 检索结果，保持相关度顺序
     * @param customerMessage 客户消息
     * @return 可直接传给 {@link com.cside.config.LLMProvider#generate(String)} 的完整 Prompt
     * @throws IllegalArgumentException 品牌或客户消息为空时抛出
     */
    public String build(
            String brand,
            String voice,
            String returnPolicy,
            String platform,
            List<String> forbiddenWords,
            List<KnowledgeChunk> ragChunks,
            String customerMessage) {
        if (brand == null || brand.isBlank()) {
            throw new IllegalArgumentException("brand must not be blank");
        }
        if (customerMessage == null || customerMessage.isBlank()) {
            throw new IllegalArgumentException("customerMessage must not be blank");
        }

        return template.replace("{brand}", brand.trim())
                .replace("{voice}", valueOrDefault(voice))
                .replace("{return_policy}", valueOrDefault(returnPolicy))
                .replace("{platform}", valueOrDefault(platform))
                .replace("{forbidden}", formatForbiddenWords(forbiddenWords))
                .replace("{rag}", formatRag(ragChunks))
                .replace("{customer_message}", customerMessage.trim());
    }

    private static String formatForbiddenWords(List<String> words) {
        if (words == null || words.isEmpty()) {
            return "无";
        }
        String joined = words.stream()
                .filter(word -> word != null && !word.isBlank())
                .map(String::trim)
                .distinct()
                .reduce((left, right) -> left + "、" + right)
                .orElse("无");
        return joined;
    }

    private static String formatRag(List<KnowledgeChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return "无可用知识，请仅依据已提供的品牌和平台政策回复。";
        }
        return chunks.stream()
                .map(chunk -> "[%s/%s] %s".formatted(
                        valueOrDefault(chunk.level()),
                        valueOrDefault(chunk.scene()),
                        valueOrDefault(chunk.content())))
                .reduce((left, right) -> left + System.lineSeparator() + right)
                .orElseThrow();
    }

    private static String valueOrDefault(String value) {
        return value == null || value.isBlank() ? "未配置" : value.trim();
    }
}
