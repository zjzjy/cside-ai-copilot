package com.cside.controller;

import com.cside.config.Result;
import com.cside.dto.StoreResponse;
import com.cside.dto.StoreUpdateRequest;
import com.cside.service.StoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stores")
@RequiredArgsConstructor
@Tag(name = "店铺配置", description = "店铺配置管理接口")
public class StoreController {

    private final StoreService storeService;

    @GetMapping
    @Operation(summary = "获取所有店铺配置", description = "返回所有店铺的配置列表（含关联品牌名）")
    public ResponseEntity<Result<List<StoreResponse>>> getAllStores() {
        List<StoreResponse> stores = storeService.getAllStores();
        return ResponseEntity.ok(Result.success(stores));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取店铺配置详情", description = "根据ID获取单个店铺的完整配置")
    public ResponseEntity<Result<StoreResponse>> getStoreById(@PathVariable Long id) {
        StoreResponse store = storeService.getStoreById(id);
        return ResponseEntity.ok(Result.success(store));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新店铺配置", description = "更新店铺信息，仅更新传入的非null字段")
    public ResponseEntity<Result<StoreResponse>> updateStore(
            @PathVariable Long id,
            @RequestBody StoreUpdateRequest request) {
        StoreResponse store = storeService.updateStore(id, request);
        return ResponseEntity.ok(Result.success(store));
    }
}
