package com.cside.controller;

import com.cside.config.Result;
import com.cside.dto.GenerateRequest;
import com.cside.dto.GenerateResponse;
import com.cside.service.GenerateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "生成", description = "AI话术生成接口")
public class GenerateController {

    private final GenerateService generateService;

    @PostMapping("/generate")
    @Operation(summary = "生成五步话术", description = "根据客户消息生成AI客服五步话术回复")
    public ResponseEntity<Result<GenerateResponse>> generate(@Valid @RequestBody GenerateRequest request) {
        GenerateResponse response = generateService.generate(request);
        return ResponseEntity.ok(Result.success(response));
    }
}
