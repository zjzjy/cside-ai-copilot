package com.cside.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class TeiEmbeddingProviderTest {

    private static final int DIMENSIONS = 1024;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private final AtomicReference<String> receivedInput = new AtomicReference<>();
    private HttpServer server;
    private URI endpoint;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        endpoint = URI.create(
                "http://localhost:" + server.getAddress().getPort() + "/v1/embeddings");
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void shouldCallTeiAndReturn1024FiniteDimensions() {
        server.createContext("/v1/embeddings", exchange -> {
            JsonNode request = objectMapper.readTree(exchange.getRequestBody());
            receivedInput.set(request.path("input").asText());
            List<Float> values = new ArrayList<>(DIMENSIONS);
            for (int index = 0; index < DIMENSIONS; index++) {
                values.add(index / (float) DIMENSIONS);
            }
            send(exchange, Map.of("data", List.of(Map.of("embedding", values))));
        });

        float[] embedding = provider(DIMENSIONS).embed("耳机不响了");

        assertThat(embedding).hasSize(DIMENSIONS);
        for (float value : embedding) {
            assertThat(value).isFinite();
        }
        assertThat(receivedInput).hasValue("耳机不响了");
    }

    @Test
    void shouldRejectWrongDimensions() {
        server.createContext("/v1/embeddings", exchange ->
                send(exchange, Map.of("data", List.of(Map.of("embedding", List.of(1, 2, 3))))));

        assertThatThrownBy(() -> provider(DIMENSIONS).embed("测试"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1024");
    }

    @Test
    void shouldRejectBlankText() {
        assertThatThrownBy(() -> provider(DIMENSIONS).embed(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private TeiEmbeddingProvider provider(int dimensions) {
        return new TeiEmbeddingProvider(
                objectMapper,
                HttpClient.newHttpClient(),
                endpoint,
                "",
                "BAAI/bge-large-zh-v1.5",
                dimensions,
                Duration.ofSeconds(2));
    }

    private void send(HttpExchange exchange, Object body) throws IOException {
        byte[] bytes = objectMapper.writeValueAsBytes(body);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
