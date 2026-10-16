package com.cside.controller;

import com.cside.config.Result;
import com.cside.dto.BrandResponse;
import com.cside.dto.BrandUpdateRequest;
import com.cside.service.BrandService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/brands")
@RequiredArgsConstructor
@Tag(name = "品牌配置", description = "品牌配置管理接口")
public class BrandController {

    private final BrandService brandService;

    @GetMapping
    @Operation(summary = "获取所有品牌配置", description = "返回所有品牌的配置列表")
    public ResponseEntity<Result<List<BrandResponse>>> getAllBrands() {
        List<BrandResponse> brands = brandService.getAllBrands();
        return ResponseEntity.ok(Result.success(brands));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取品牌配置详情", description = "根据ID获取单个品牌的完整配置")
    public ResponseEntity<Result<BrandResponse>> getBrandById(@PathVariable Long id) {
        BrandResponse brand = brandService.getBrandById(id);
        return ResponseEntity.ok(Result.success(brand));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新品牌配置", description = "全量替换指定品牌的config配置（PUT语义）")
    public ResponseEntity<Result<BrandResponse>> updateBrand(
            @PathVariable Long id,
            @RequestBody BrandUpdateRequest request) {
        BrandResponse brand = brandService.updateBrand(id, request);
        return ResponseEntity.ok(Result.success(brand));
    }
}
