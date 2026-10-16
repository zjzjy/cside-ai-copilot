package com.cside.service;

import com.cside.config.EmbeddingProvider;
import com.cside.repository.KnowledgeVectorInsert;
import com.cside.repository.KnowledgeVectorRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
public class KnowledgeImportService {

    private static final int BATCH_SIZE = 50;

    private final KnowledgeVectorRepository repository;
    private final EmbeddingProvider embeddingProvider;
    private final ObjectMapper objectMapper;
    private final String seedPath;

    public KnowledgeImportService(
            KnowledgeVectorRepository repository,
            EmbeddingProvider embeddingProvider,
            ObjectMapper objectMapper,
            @Value("${cside.knowledge.seed-path:../data/seed}") String seedPath) {
        this.repository = repository;
        this.embeddingProvider = embeddingProvider;
        this.objectMapper = objectMapper;
        this.seedPath = seedPath;
    }

    @SuppressWarnings("unchecked")
    public int importAll() {
        List<KnowledgeVectorInsert> batch = new ArrayList<>();
        int total = 0;
        try {
            Path root = Paths.get(seedPath);
            if (!Files.exists(root)) {
                log.warn("Seed path does not exist: {}", seedPath);
                return 0;
            }
            try (Stream<Path> files = Files.walk(root)) {
                List<Path> jsonFiles = files
                        .filter(Files::isRegularFile)
                        .filter(p -> p.toString().endsWith(".json"))
                        .toList();
                for (Path file : jsonFiles) {
                    try {
                        List<KnowledgeVectorInsert> items = processFile(file);
                        for (KnowledgeVectorInsert item : items) {
                            if (repository.existsBySourceId(item.sourceId())) {
                                continue;
                            }
                            batch.add(item);
                            if (batch.size() >= BATCH_SIZE) {
                                repository.batchInsertKnowledge(batch);
                                total += batch.size();
                                batch.clear();
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to process seed file {}: {}", file, e.getMessage());
                    }
                }
                if (!batch.isEmpty()) {
                    repository.batchInsertKnowledge(batch);
                    total += batch.size();
                }
            }
            log.info("Knowledge import completed: {} records inserted", total);
        } catch (Exception e) {
            log.error("Knowledge import failed", e);
        }
        return total;
    }

    @SuppressWarnings("unchecked")
    private List<KnowledgeVectorInsert> processFile(Path file) throws Exception {
        String content = Files.readString(file, StandardCharsets.UTF_8);
        String relativePath = file.toString().replace('\\', '/');
        String brand = extractBrand(relativePath);
        String level = extractLevel(relativePath);

        // Brand config files are config only, not knowledge
        if (relativePath.contains("brand-config.json")) {
            return List.of();
        }

        // Products: JSON array
        if (relativePath.contains("products.json")) {
            List<Map<String, Object>> products = objectMapper.readValue(content, List.class);
            return products.stream()
                    .map(p -> toInsert(p, "product", level,
                            (String) p.getOrDefault("brand", brand), null,
                            (String) p.getOrDefault("category", ""),
                            (String) p.getOrDefault("category", ""),
                            (String) p.getOrDefault("sku_id", "")))
                    .toList();
        }

        // Platform policies: object with platforms key
        if (relativePath.contains("platform-policies.json")) {
            return List.of();
        }

        // Store promotions
        if (relativePath.contains("stores/")) {
            Map<String, Object> storeData = objectMapper.readValue(content, Map.class);
            String storeBrand = (String) storeData.getOrDefault("brand", brand);
            String storePlatform = (String) storeData.getOrDefault("platform", "");
            String storeId = (String) storeData.getOrDefault("store_id", "");
            List<KnowledgeVectorInsert> items = new ArrayList<>();
            List<Map<String, Object>> promos = (List<Map<String, Object>>) storeData.get("current_promotions");
            if (promos != null) {
                for (Map<String, Object> promo : promos) {
                    items.add(new KnowledgeVectorInsert(
                            (String) promo.getOrDefault("id", storeId + "-promo"),
                            "promotion", "store", storeBrand, storePlatform, "promotion",
                            (String) promo.getOrDefault("name", ""),
                            promo.toString(), embed(promo.toString()),
                            objectMapper.writeValueAsString(promo)));
                }
            }
            Map<String, Object> rules = (Map<String, Object>) storeData.get("store_specific_rules");
            if (rules != null) {
                items.add(new KnowledgeVectorInsert(
                        storeId + "-rules", "store_rule", "store", storeBrand,
                        storePlatform, "rules", "店铺规则",
                        rules.toString(), embed(rules.toString()),
                        objectMapper.writeValueAsString(rules)));
            }
            return items;
        }

        // FAQ files
        if (relativePath.contains("faq.json")) {
            Map<String, Object> faqData = objectMapper.readValue(content, Map.class);
            List<Map<String, Object>> faqs = (List<Map<String, Object>>) faqData.get("faqs");
            if (faqs == null) return List.of();
            return faqs.stream()
                    .map(faq -> {
                        String sourceId = (String) faq.getOrDefault("id", "");
                        List<String> tags = (List<String>) faq.getOrDefault("tags", List.of());
                        String scene = tags.isEmpty() ? "general" : tags.get(0);
                        String text = "Q: " + faq.getOrDefault("q", "")
                                + "\nA: " + faq.getOrDefault("a", "");
                        return new KnowledgeVectorInsert(
                                sourceId, "faq", level, brand, null,
                                tags.size() > 1 ? tags.get(1) : scene, scene,
                                text, embed(text),
                                objectMapper.writeValueAsString(Map.of("tags", tags)));
                    }).toList();
        }

        // Scripts files (common or brand)
        if (relativePath.contains("scripts.json")) {
            Map<String, Object> scriptData = objectMapper.readValue(content, Map.class);
            List<Map<String, Object>> scripts = (List<Map<String, Object>>) scriptData.get("scripts");
            if (scripts == null) return List.of();
            return scripts.stream()
                    .map(script -> {
                        String sourceId = (String) script.getOrDefault("id", "");
                        List<String> tags = (List<String>) script.getOrDefault("tags", List.of());
                        String scene = (String) script.getOrDefault("scene", "general");
                        Object fiveStep = script.get("five_step");
                        String text;
                        if (fiveStep instanceof Map<?, ?>) {
                            text = objectMapper.valueToTree(fiveStep).toString();
                        } else {
                            text = (String) script.getOrDefault("content", "");
                        }
                        return new KnowledgeVectorInsert(
                                sourceId, "script", level, brand, null,
                                tags.size() > 1 ? tags.get(1) : scene, scene,
                                text, embed(text),
                                objectMapper.writeValueAsString(Map.of("tags", tags, "scene", scene)));
                    }).toList();
        }

        return List.of();
    }

    private KnowledgeVectorInsert toInsert(Map<String, Object> data, String sourceType,
            String level, String brand, String platform, String category, String scene, String sourceId) {
        String text = objectMapper.valueToTree(data).toString();
        return new KnowledgeVectorInsert(sourceId, sourceType, level, brand, platform,
                category, scene, text, embed(text),
                objectMapper.writeValueAsString(data));
    }

    private float[] embed(String text) {
        try {
            return embeddingProvider.embed(text);
        } catch (Exception e) {
            log.debug("Embedding failed for text (len={}), storing without vector: {}", text.length(), e.getMessage());
            return null;
        }
    }

    private String extractBrand(String relativePath) {
        if (relativePath.contains("brands/")) {
            int start = relativePath.indexOf("brands/") + 7;
            int end = relativePath.indexOf('/', start);
            return end > 0 ? relativePath.substring(start, end) : relativePath.substring(start);
        }
        return null;
    }

    private String extractLevel(String relativePath) {
        if (relativePath.contains("common/")) return "common";
        if (relativePath.contains("stores/")) return "store";
        if (relativePath.contains("brands/")) return "brand";
        return "common";
    }
}
