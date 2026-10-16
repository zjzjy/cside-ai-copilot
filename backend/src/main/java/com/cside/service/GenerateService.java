package com.cside.service;

import com.cside.config.LLMProvider;
import com.cside.dto.GenerateRequest;
import com.cside.dto.GenerateResponse;
import com.cside.dto.KnowledgeChunk;
import com.cside.entity.Brand;
import com.cside.entity.Conversation;
import com.cside.entity.Message;
import com.cside.entity.Store;
import com.cside.entity.User;
import com.cside.repository.BrandRepository;
import com.cside.repository.ConversationRepository;
import com.cside.repository.MessageRepository;
import com.cside.repository.StoreRepository;
import com.cside.repository.UserRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateService {

    private static final int MAX_MESSAGE_LENGTH = 500;

    private final LLMProvider llmProvider;
    private final RAGService ragService;
    private final PromptBuilder promptBuilder;
    private final PlatformPolicyService platformPolicyService;
    private final BrandRepository brandRepository;
    private final StoreRepository storeRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @SuppressWarnings("unchecked")
    @Transactional
    public GenerateResponse generate(GenerateRequest request) {
        String customerMessage = request.getCustomerMessage();
        if (customerMessage == null || customerMessage.isBlank()) {
            throw new IllegalArgumentException("客户消息不能为空 (3002)");
        }
        if (customerMessage.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("客户消息不能超过500字 (3003)");
        }

        // Resolve user from JWT
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("用户不存在"));

        // Resolve brand
        String brand = request.getBrand().trim();
        Brand brandEntity = brandRepository.findByName(brand)
                .orElseThrow(() -> new IllegalArgumentException("品牌不存在: " + brand));

        String platform = request.getPlatform() != null ? request.getPlatform().trim() : "";
        String storeId = request.getStoreId();

        // Resolve conversation
        Conversation conversation;
        if (request.getConversationId() != null) {
            conversation = conversationRepository.findById(request.getConversationId())
                    .orElseThrow(() -> new IllegalArgumentException("对话不存在"));
        } else {
            conversation = new Conversation();
            conversation.setUserId(user.getId());
            conversation.setBrand(brand);
            conversation.setPlatform(platform);
            conversation.setStatus("active");
            // Resolve store
            Store store = storeRepository.findFirstByBrandIdAndPlatform(brandEntity.getId(), platform).orElse(null);
            if (store == null) {
                store = storeRepository.findById(1L).orElse(null);
            }
            conversation.setStoreId(store != null ? store.getId() : 1L);
            conversation = conversationRepository.save(conversation);
        }

        // Load brand config
        Map<String, Object> config = brandEntity.getConfig();
        String voice = "";
        if (config != null) {
            String tone = (String) config.getOrDefault("tone", "");
            String style = (String) config.getOrDefault("style", "");
            voice = tone + (tone.isEmpty() || style.isEmpty() ? "" : "，") + style;
        }
        String returnPolicy = config != null ? (String) config.getOrDefault("return_policy", "") : "";
        List<String> forbiddenWords = config != null
                ? (List<String>) config.getOrDefault("forbidden_words", List.of())
                : List.of();

        // Load platform policy
        Map<String, Object> platformPolicy = platformPolicyService.getPlatformPolicy(platform);
        String platformPolicyStr = platformPolicy.isEmpty() ? "" : platformPolicy.toString();

        // RAG search
        List<KnowledgeChunk> ragChunks = ragService.search(customerMessage, brand, platform, storeId);

        // Build prompt
        String prompt = promptBuilder.build(
                brand, voice, returnPolicy, platformPolicyStr, forbiddenWords, ragChunks, customerMessage);

        // Call LLM
        String llmResponse;
        try {
            llmResponse = llmProvider.generate(prompt);
        } catch (Exception e) {
            log.error("LLM generation failed: {}", e.getMessage());
            throw new IllegalStateException("LLM生成失败: " + e.getMessage() + " (2001)");
        }

        // Parse response
        Map<String, String> fiveStep;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(llmResponse, Map.class);
            fiveStep = new HashMap<>();
            fiveStep.put("step1_intent", String.valueOf(parsed.getOrDefault("step1_intent", "")));
            fiveStep.put("step2_strategy", String.valueOf(parsed.getOrDefault("step2_strategy", "")));
            fiveStep.put("step3_script", String.valueOf(parsed.getOrDefault("step3_script", "")));
            fiveStep.put("step4_hook", String.valueOf(parsed.getOrDefault("step4_hook", "")));
            fiveStep.put("step5_close", String.valueOf(parsed.getOrDefault("step5_close", "")));
        } catch (Exception e) {
            log.error("Failed to parse LLM response: {}", e.getMessage());
            throw new IllegalStateException("LLM返回格式异常: " + e.getMessage() + " (2002)");
        }

        // Save messages
        Message customerMsg = new Message();
        customerMsg.setConversationId(conversation.getId());
        customerMsg.setRole("customer");
        customerMsg.setContent(customerMessage);
        List<String> ragSourceIds = ragChunks.stream().map(KnowledgeChunk::sourceId).toList();
        customerMsg.setMetadata(Map.of("rag_sources", ragSourceIds));
        messageRepository.save(customerMsg);

        Message agentMsg = new Message();
        agentMsg.setConversationId(conversation.getId());
        agentMsg.setRole("agent");
        agentMsg.setContent(fiveStep.getOrDefault("step3_script", ""));
        agentMsg.setMetadata(Map.of("five_step", fiveStep, "brand", brand, "platform", platform));
        messageRepository.save(agentMsg);

        // Build response
        GenerateResponse response = new GenerateResponse();
        response.setConversationId(conversation.getId());
        response.setBrand(brand);
        response.setPlatform(platform);
        response.setFiveStep(fiveStep);
        response.setRetrievedChunks(ragChunks);
        return response;
    }
}
