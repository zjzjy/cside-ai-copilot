package com.cside.service;

import com.cside.dto.CollectionRequest;
import com.cside.dto.CollectionResponse;
import com.cside.entity.Collection;
import com.cside.entity.Conversation;
import com.cside.entity.User;
import com.cside.repository.CollectionRepository;
import com.cside.repository.ConversationRepository;
import com.cside.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    public CollectionResponse createCollection(CollectionRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        Long storeId = 1L;
        String brand = "vivo";
        String platform = "taobao";

        if (request.getConversationId() != null) {
            Conversation conversation = conversationRepository.findById(request.getConversationId())
                    .orElse(null);
            if (conversation != null) {
                storeId = conversation.getStoreId();
                brand = conversation.getBrand();
                platform = conversation.getPlatform();
            }
        }

        Collection collection = new Collection();
        collection.setUserId(user.getId());
        collection.setStoreId(storeId);
        collection.setBrand(brand);
        collection.setPlatform(platform);
        collection.setStepType(request.getStepType());
        collection.setContent(request.getContent());
        collection.setConversationId(request.getConversationId());
        collection.setCustomerMessage(request.getCustomerMessage());
        collection.setTags(request.getTags() != null ? request.getTags() : List.of());

        Collection saved = collectionRepository.save(collection);
        log.info("Collection created: id={}, userId={}, brand={}", saved.getId(), user.getId(), brand);

        return toResponse(saved);
    }

    public Page<CollectionResponse> getCollections(String brand, String stepType, int page, int size) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Collection> collections;
        if (brand != null && stepType != null) {
            collections = collectionRepository.findByUserIdAndBrandAndStepType(user.getId(), brand, stepType, pageable);
        } else if (brand != null) {
            collections = collectionRepository.findByUserIdAndBrand(user.getId(), brand, pageable);
        } else if (stepType != null) {
            collections = collectionRepository.findByUserIdAndStepType(user.getId(), stepType, pageable);
        } else {
            collections = collectionRepository.findByUserId(user.getId(), pageable);
        }

        return collections.map(this::toResponse);
    }

    private CollectionResponse toResponse(Collection collection) {
        return new CollectionResponse(
                collection.getId(),
                collection.getStepType(),
                collection.getContent(),
                collection.getCustomerMessage(),
                collection.getBrand(),
                collection.getPlatform(),
                collection.getTags(),
                collection.getCreatedAt()
        );
    }
}