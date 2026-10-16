package com.cside.config;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Embedding 向量化接口。
 *
 * <p>实现类负责调用具体 Embedding 服务，上层业务只依赖本接口。
 */
public interface EmbeddingProvider {

    /**
     * 将文本转换为 bge-large-zh-v1.5 的 1024 维向量。
     *
     * @param text 非 {@code null}、非空的待向量化文本
     * @return 非 {@code null} 的 1024 维有限浮点数组
     * @throws IllegalArgumentException 文本为空时抛出
     * @throws IllegalStateException Embedding 服务调用失败或返回格式错误时抛出
     */
    float[] embed(String text);
}

/** 通过 Hugging Face Text Embeddings Inference 调用真实 BGE 模型。 */
@Component
@ConditionalOnProperty(
        name = "cside.embedding.provider",
        havingValue = "tei",
        matchIfMissing = true)
class TeiEmbeddingProvider implements EmbeddingProvider {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI endpoint;
    private final String apiKey;
    private final String model;
    private final int dimensions;
    private final Duration requestTimeout;

    @Autowired
    TeiEmbeddingProvider(
            ObjectMapper objectMapper,
            @Value("${cside.embedding.connect-timeout:10s}") Duration connectTimeout,
            @Value("${cside.embedding.request-timeout:60s}") Duration requestTimeout,
            @Value("${cside.embedding.base-url:http://localhost:8182/v1}") String baseUrl,
            @Value("${cside.embedding.api-key:}") String apiKey,
            @Value("${cside.embedding.model:BAAI/bge-large-zh-v1.5}") String model,
            @Value("${cside.embedding.dimensions:1024}") int dimensions) {
        this(
                objectMapper,
                HttpClient.newBuilder().connectTimeout(connectTimeout).build(),
                embeddingsUri(baseUrl),
                apiKey,
                model,
                dimensions,
                requestTimeout);
    }

    TeiEmbeddingProvider(
            ObjectMapper objectMapper,
            HttpClient httpClient,
            URI endpoint,
            String apiKey,
            String model,
            int dimensions,
            Duration requestTimeout) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.model = model;
        this.dimensions = dimensions;
        this.requestTimeout = requestTimeout;
    }

    @Override
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("text must not be blank");
        }

        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("input", text.trim());
            body.put("model", model);
            body.put("encoding_format", "float");
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(endpoint)
                    .timeout(requestTimeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (apiKey != null && !apiKey.isBlank()) {
                requestBuilder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> response =
                    httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Embedding service returned HTTP " + response.statusCode());
            }
            return parseEmbedding(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Embedding request interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Embedding request failed", exception);
        }
    }

    private float[] parseEmbedding(String responseBody) throws IOException {
        JsonNode embedding = objectMapper
                .readTree(responseBody)
                .path("data")
                .path(0)
                .path("embedding");
        if (!embedding.isArray() || embedding.size() != dimensions) {
            throw new IllegalStateException(
                    "Embedding response must contain " + dimensions + " dimensions");
        }

        float[] values = new float[dimensions];
        for (int index = 0; index < dimensions; index++) {
            values[index] = embedding.get(index).floatValue();
            if (!Float.isFinite(values[index])) {
                throw new IllegalStateException("Embedding response contains a non-finite value");
            }
        }
        return values;
    }

    private static URI embeddingsUri(String baseUrl) {
        String normalized = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        return URI.create(normalized + "/embeddings");
    }
}

/** 通过阿里云 DashScope 调用 text-embedding-v3（1024 维）。切换方式：cside.embedding.provider=qwen */
@Component
@ConditionalOnProperty(
        name = "cside.embedding.provider",
        havingValue = "qwen")
class QwenEmbeddingProvider implements EmbeddingProvider {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI endpoint;
    private final String apiKey;
    private final String model;
    private final int dimensions;
    private final Duration requestTimeout;

    QwenEmbeddingProvider(
            ObjectMapper objectMapper,
            @Value("${cside.embedding.connect-timeout:10s}") Duration connectTimeout,
            @Value("${cside.embedding.request-timeout:60s}") Duration requestTimeout,
            @Value("${cside.embedding.qwen.base-url:https://dashscope.aliyuncs.com/compatible-mode/v1}")
            String baseUrl,
            @Value("${cside.embedding.qwen.api-key:#{null}}") String apiKey,
            @Value("${cside.embedding.qwen.model:text-embedding-v3}") String model,
            @Value("${cside.embedding.dimensions:1024}") int dimensions) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
        this.endpoint = URI.create(baseUrl.endsWith("/") ? baseUrl + "embeddings" : baseUrl + "/embeddings");
        this.apiKey = apiKey;
        this.model = model;
        this.dimensions = dimensions;
        this.requestTimeout = requestTimeout;
    }

    @Override
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("text must not be blank");
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("input", text.trim());
            body.put("model", model);
            Map<String, String> dimParam = new LinkedHashMap<>();
            dimParam.put("dimensions", String.valueOf(dimensions));
            body.put("parameters", dimParam);

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(endpoint)
                    .timeout(requestTimeout)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));

            HttpResponse<String> response =
                    httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Qwen embedding service returned HTTP " + response.statusCode()
                        + ": " + response.body());
            }
            return parseEmbedding(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Qwen embedding request interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Qwen embedding request failed", exception);
        }
    }

    private float[] parseEmbedding(String responseBody) throws IOException {
        JsonNode embedding = objectMapper
                .readTree(responseBody)
                .path("data")
                .path(0)
                .path("embedding");
        if (!embedding.isArray() || embedding.size() != dimensions) {
            throw new IllegalStateException(
                    "Qwen embedding response must contain " + dimensions + " dimensions");
        }
        float[] values = new float[dimensions];
        for (int index = 0; index < dimensions; index++) {
            values[index] = embedding.get(index).floatValue();
            if (!Float.isFinite(values[index])) {
                throw new IllegalStateException("Qwen embedding response contains a non-finite value");
            }
        }
        return values;
    }
}
