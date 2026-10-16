package com.cside.service;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
public class PlatformPolicyService {

    private final Map<String, Map<String, Object>> platformCache = new ConcurrentHashMap<>();

    @SuppressWarnings("unchecked")
    public PlatformPolicyService(
            ObjectMapper objectMapper,
            ResourceLoader resourceLoader,
            @Value("${cside.knowledge.policy-file:../data/seed/common/platform-policies.json}")
            String policyFileLocation) {
        try {
            Resource resource = resourceLoader.getResource("file:" + policyFileLocation);
            if (resource.exists()) {
                String json = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                Map<String, Object> root = objectMapper.readValue(json, Map.class);
                Object platformsObj = root.get("platforms");
                if (platformsObj instanceof Map<?, ?> platformsMap) {
                    for (Map.Entry<?, ?> entry : platformsMap.entrySet()) {
                        if (entry.getValue() instanceof Map<?, ?> policyMap) {
                            Map<String, Object> policy = new HashMap<>();
                            policyMap.forEach((k, v) -> policy.put(String.valueOf(k), v));
                            platformCache.put(String.valueOf(entry.getKey()), policy);
                        }
                    }
                }
                log.info("Loaded platform policies for: {}", platformCache.keySet());
            } else {
                log.warn("Platform policy file not found: {}", policyFileLocation);
            }
        } catch (Exception e) {
            log.warn("Failed to load platform policy file '{}': {}", policyFileLocation, e.getMessage());
        }
    }

    public Map<String, Object> getPlatformPolicy(String platform) {
        if (platform == null || platform.isBlank()) {
            return Collections.emptyMap();
        }
        return platformCache.getOrDefault(platform.trim().toLowerCase(), Collections.emptyMap());
    }
}
