package com.cside.config;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * LLM 调用接口。
 *
 * <p>实现类负责与具体的大模型 API 交互，上层业务只依赖本接口，切换模型无需修改调用方。
 */
public interface LLMProvider {

    /**
     * 发送 Prompt 给 LLM，返回经过五步格式校验的 JSON 字符串。
     *
     * @param prompt 非 {@code null}、非空的完整 Prompt 文本，包含系统指令、RAG 上下文和客户消息
     * @return 非 {@code null} 的五步 JSON；五个字段均满足模板规定的最短长度
     * @throws IllegalArgumentException Prompt 为空时抛出
     * @throws IllegalStateException 所有已配置模型均不可用或返回无效 JSON 时抛出
     */
    String generate(String prompt);
}

/** 按环境变量配置顺序调用 OpenAI 兼容接口，并在失败时切换到下一模型。 */
@Component
@ConditionalOnProperty(
        name = "cside.llm.provider",
        havingValue = "real",
        matchIfMissing = true)
class FallbackLLMProvider implements LLMProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(FallbackLLMProvider.class);
    private static final Map<String, Integer> REQUIRED_FIELDS = Map.of(
            "step1_intent", 10,
            "step2_strategy", 10,
            "step3_script", 20,
            "step4_hook", 5,
            "step5_close", 5);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Duration requestTimeout;
    private final double temperature;
    private final int maxTokens;
    private final List<LLMEndpoint> endpoints;

    @Autowired
    FallbackLLMProvider(
            ObjectMapper objectMapper,
            @Value("${cside.llm.connect-timeout:10s}") Duration connectTimeout,
            @Value("${cside.llm.request-timeout:45s}") Duration requestTimeout,
            @Value("${cside.llm.temperature:0.2}") double temperature,
            @Value("${cside.llm.max-tokens:1200}") int maxTokens,
            @Value("${cside.llm.fallback-order:deepseek,qwen,hunyuan}") String fallbackOrder,
            @Value("${cside.llm.deepseek.api-key:}") String deepseekApiKey,
            @Value("${cside.llm.deepseek.base-url:https://api.deepseek.com}")
                    String deepseekBaseUrl,
            @Value("${cside.llm.deepseek.model:deepseek-v4-flash}") String deepseekModel,
            @Value("${cside.llm.qwen.api-key:}") String qwenApiKey,
            @Value("${cside.llm.qwen.base-url:https://dashscope.aliyuncs.com/compatible-mode/v1}")
                    String qwenBaseUrl,
            @Value("${cside.llm.qwen.model:qwen3.5-plus}") String qwenModel,
            @Value("${cside.llm.qwen.enable-thinking:false}") boolean qwenEnableThinking,
            @Value("${cside.llm.hunyuan.api-key:}") String hunyuanApiKey,
            @Value("${cside.llm.hunyuan.base-url:https://tokenhub.tencentmaas.com/v1}")
                    String hunyuanBaseUrl,
            @Value("${cside.llm.hunyuan.model:hy3}") String hunyuanModel,
            @Value("${cside.llm.hunyuan.reasoning-effort:low}") String hunyuanReasoningEffort) {
        this(
                objectMapper,
                HttpClient.newBuilder().connectTimeout(connectTimeout).build(),
                requestTimeout,
                temperature,
                maxTokens,
                orderedEndpoints(
                        fallbackOrder,
                        Map.of(
                                "deepseek",
                                new LLMEndpoint(
                                        "deepseek",
                                        deepseekApiKey,
                                        deepseekBaseUrl,
                                        deepseekModel,
                                        Map.of()),
                                "qwen",
                                new LLMEndpoint(
                                        "qwen",
                                        qwenApiKey,
                                        qwenBaseUrl,
                                        qwenModel,
                                        Map.of("enable_thinking", qwenEnableThinking)),
                                "hunyuan",
                                new LLMEndpoint(
                                        "hunyuan",
                                        hunyuanApiKey,
                                        hunyuanBaseUrl,
                                        hunyuanModel,
                                        Map.of("reasoning_effort", hunyuanReasoningEffort)))));
    }

    FallbackLLMProvider(
            ObjectMapper objectMapper,
            HttpClient httpClient,
            Duration requestTimeout,
            double temperature,
            int maxTokens,
            List<LLMEndpoint> endpoints) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.requestTimeout = requestTimeout;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.endpoints = List.copyOf(endpoints);
    }

    @Override
    public String generate(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("prompt must not be blank");
        }

        List<String> failures = new ArrayList<>();
        int configuredEndpoints = 0;
        for (LLMEndpoint endpoint : endpoints) {
            if (!endpoint.enabled()) {
                continue;
            }
            configuredEndpoints++;
            try {
                String response = call(endpoint, prompt.trim());
                validateFiveStepJson(response);
                return response;
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("LLM request interrupted", exception);
            } catch (Exception exception) {
                failures.add(endpoint.name() + ": " + safeMessage(exception));
                LOGGER.warn("LLM {} 调用失败，尝试下一候选：{}", endpoint.name(), safeMessage(exception));
            }
        }

        if (configuredEndpoints == 0) {
            throw new IllegalStateException("no LLM endpoint has an API key configured");
        }
        throw new IllegalStateException("all configured LLM endpoints failed: " + String.join("; ", failures));
    }

    private String call(LLMEndpoint endpoint, String prompt)
            throws IOException, InterruptedException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", endpoint.model());
        body.put("messages", List.of(Map.of("role", "user", "content", prompt)));
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", false);
        body.put("response_format", Map.of("type", "json_object"));
        body.putAll(endpoint.options());

        HttpRequest request = HttpRequest.newBuilder(endpoint.chatCompletionsUri())
                .timeout(requestTimeout)
                .header("Authorization", "Bearer " + endpoint.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (!content.isTextual() || content.asText().isBlank()) {
            throw new IllegalStateException("response has no message content");
        }
        return content.asText().trim();
    }

    private void validateFiveStepJson(String response) throws IOException {
        JsonNode root = objectMapper.readTree(response);
        if (!root.isObject()) {
            throw new IllegalStateException("LLM content is not a JSON object");
        }
        for (Map.Entry<String, Integer> requirement : REQUIRED_FIELDS.entrySet()) {
            JsonNode value = root.get(requirement.getKey());
            if (value == null
                    || !value.isTextual()
                    || value.asText().codePointCount(0, value.asText().length())
                            < requirement.getValue()) {
                throw new IllegalStateException(
                        requirement.getKey() + " does not meet output requirements");
            }
        }
    }

    private static List<LLMEndpoint> orderedEndpoints(
            String fallbackOrder, Map<String, LLMEndpoint> available) {
        List<LLMEndpoint> ordered = new ArrayList<>();
        for (String name : fallbackOrder.split(",")) {
            LLMEndpoint endpoint = available.get(name.trim().toLowerCase(Locale.ROOT));
            if (endpoint != null && !ordered.contains(endpoint)) {
                ordered.add(endpoint);
            }
        }
        return ordered;
    }

    private static String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? exception.getClass().getSimpleName()
                : message;
    }

    record LLMEndpoint(
            String name,
            String apiKey,
            String baseUrl,
            String model,
            Map<String, Object> options) {

        boolean enabled() {
            return apiKey != null
                    && !apiKey.isBlank()
                    && baseUrl != null
                    && !baseUrl.isBlank()
                    && model != null
                    && !model.isBlank();
        }

        URI chatCompletionsUri() {
            String normalized = baseUrl.endsWith("/")
                    ? baseUrl.substring(0, baseUrl.length() - 1)
                    : baseUrl;
            return URI.create(normalized + "/chat/completions");
        }
    }
}
