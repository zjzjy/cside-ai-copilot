package com.cside.controller;

import com.cside.config.Result;
import com.cside.dto.ConversationResponse;
import com.cside.service.ConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
@Tag(name = "对话", description = "对话历史接口")
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/{id}")
    @Operation(summary = "获取对话详情", description = "获取指定对话的详细信息，包含消息列表")
    public ResponseEntity<Result<ConversationResponse>> getConversation(@PathVariable Long id) {
        ConversationResponse response = conversationService.getConversation(id);
        return ResponseEntity.ok(Result.success(response));
    }
}