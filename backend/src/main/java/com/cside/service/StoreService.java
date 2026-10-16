package com.cside.service;

import com.cside.dto.StoreResponse;
import com.cside.dto.StoreUpdateRequest;
import com.cside.entity.Store;
import com.cside.repository.BrandRepository;
import com.cside.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;
    private final BrandRepository brandRepository;

    public List<StoreResponse> getAllStores() {
        return storeRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public StoreResponse getStoreById(Long id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("店铺不存在(5101)"));
        return toResponse(store);
    }

    public StoreResponse updateStore(Long id, StoreUpdateRequest request) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("店铺不存在(5101)"));
        if (request.getName() != null) {
            store.setName(request.getName());
        }
        if (request.getUrlPattern() != null) {
            store.setUrlPattern(request.getUrlPattern());
        }
        if (request.getConfig() != null) {
            store.setConfig(request.getConfig());
        }
        store.setUpdatedAt(LocalDateTime.now());
        Store saved = storeRepository.save(store);
        log.info("Store config updated: id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    private StoreResponse toResponse(Store store) {
        String brandName = brandRepository.findById(store.getBrandId())
                .map(b -> b.getName())
                .orElse("");
        return new StoreResponse(
                store.getId(),
                store.getName(),
                store.getBrandId(),
                brandName,
                store.getPlatform(),
                store.getUrlPattern(),
                store.getConfig(),
                store.getCreatedAt(),
                store.getUpdatedAt()
        );
    }
}
