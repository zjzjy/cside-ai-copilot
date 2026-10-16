package com.cside.service;

import com.cside.dto.BrandResponse;
import com.cside.dto.BrandUpdateRequest;
import com.cside.entity.Brand;
import com.cside.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrandService {

    private final BrandRepository brandRepository;

    public List<BrandResponse> getAllBrands() {
        return brandRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public BrandResponse getBrandById(Long id) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("品牌不存在(5001)"));
        return toResponse(brand);
    }

    public BrandResponse updateBrand(Long id, BrandUpdateRequest request) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("品牌不存在(5001)"));
        if (request.getConfig() != null) {
            brand.setConfig(request.getConfig());
        }
        brand.setUpdatedAt(LocalDateTime.now());
        Brand saved = brandRepository.save(brand);
        log.info("Brand config updated: id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    private BrandResponse toResponse(Brand brand) {
        return new BrandResponse(
                brand.getId(),
                brand.getName(),
                brand.getConfig(),
                brand.getCreatedAt(),
                brand.getUpdatedAt()
        );
    }
}
