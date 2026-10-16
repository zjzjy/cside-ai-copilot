package com.cside.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class FallbackLLMProviderTest {

    private static final String VALID_FIVE_STEP_JSON = """
        {
          "step1_intent": "客户反馈耳机出现单边无声问题并且情绪焦急",
          "step2_strategy": "先安抚客户情绪再指导重置连接并核对售后权益",
          "step3_script": "您好，非常抱歉影响您的使用体验，请先将耳机放回充电盒重置并重新配对，我也可以立即协助登记售后检测。",
          "step4_hook": "请把订单号发给我继续处理",
          "step5_close": "处理完成后还可领取专属服务权益"
        }
        """;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private final List<String> requestedModels = new CopyOnWriteArrayList<>();
    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        baseUrl = "http://localhost:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void shouldFallbackFromDeepSeekToQwenThenHunyuan() {
        server.createContext("/deepseek/chat/completions", exchange -> {
            recordModel(exchange);
            send(exchange, 503, "{}");
        });
        server.createContext("/qwen/chat/completions", exchange -> {
            recordModel(exchange);
            sendCompletion(exchange, "{\"step1_intent\":\"too short\"}");
        });
        server.createContext("/hunyuan/chat/completions", exchange -> {
            recordModel(exchange);
            sendCompletion(exchange, VALID_FIVE_STEP_JSON);
        });

        FallbackLLMProvider provider = provider();

        assertThat(provider.generate("完整测试提示词")).isEqualTo(VALID_FIVE_STEP_JSON.trim());
        assertThat(requestedModels)
                .containsExactly("deepseek-v4-flash", "qwen3.5-plus", "hy3");
    }

    @Test
    void shouldStopAfterPrimaryModelSucceeds() {
        server.createContext("/deepseek/chat/completions", exchange -> {
            recordModel(exchange);
            sendCompletion(exchange, VALID_FIVE_STEP_JSON);
        });

        assertThat(provider().generate("完整测试提示词")).isEqualTo(VALID_FIVE_STEP_JSON.trim());
        assertThat(requestedModels).containsExactly("deepseek-v4-flash");
    }

    @Test
    void shouldRejectBlankPrompt() {
        assertThatThrownBy(() -> provider().generate("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private FallbackLLMProvider provider() {
        return new FallbackLLMProvider(
                objectMapper,
                HttpClient.newHttpClient(),
                Duration.ofSeconds(2),
                0.2,
                1200,
                List.of(
                        endpoint("deepseek", "deepseek-v4-flash"),
                        endpoint("qwen", "qwen3.5-plus"),
                        endpoint("hunyuan", "hy3")));
    }

    private FallbackLLMProvider.LLMEndpoint endpoint(String name, String model) {
        return new FallbackLLMProvider.LLMEndpoint(
                name, "test-key", baseUrl + "/" + name, model, Map.of());
    }

    private void recordModel(HttpExchange exchange) throws IOException {
        JsonNode request = objectMapper.readTree(exchange.getRequestBody());
        requestedModels.add(request.path("model").asText());
    }

    private void sendCompletion(HttpExchange exchange, String content) throws IOException {
        String response = objectMapper.writeValueAsString(new CompletionResponse(List.of(
                new Choice(new Message(content)))));
        send(exchange, 200, response);
    }

    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private record CompletionResponse(List<Choice> choices) {}

    private record Choice(Message message) {}

    private record Message(String content) {}
}
