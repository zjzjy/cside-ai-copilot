package com.cside.controller;

import com.cside.config.Result;
import com.cside.dto.CollectionRequest;
import com.cside.dto.CollectionResponse;
import com.cside.service.CollectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/collections")
@RequiredArgsConstructor
@Tag(name = "收藏", description = "话术收藏接口")
public class CollectionController {

    private final CollectionService collectionService;

    @PostMapping
    @Operation(summary = "创建收藏", description = "收藏一条话术到个人话术库")
    public ResponseEntity<Result<CollectionResponse>> createCollection(@Valid @RequestBody CollectionRequest request) {
        CollectionResponse response = collectionService.createCollection(request);
        return ResponseEntity.ok(Result.success(response));
    }

    @GetMapping
    @Operation(summary = "获取收藏列表", description = "分页获取个人收藏的话术列表，支持按品牌和步骤类型筛选")
    public ResponseEntity<Result<Page<CollectionResponse>>> getCollections(
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String stepType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<CollectionResponse> response = collectionService.getCollections(brand, stepType, page, size);
        return ResponseEntity.ok(Result.success(response));
    }
}