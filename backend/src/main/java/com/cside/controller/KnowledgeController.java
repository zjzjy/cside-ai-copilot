package com.cside.controller;

import com.cside.config.Result;
import com.cside.service.KnowledgeImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/knowledge")
@RequiredArgsConstructor
@Tag(name = "知识库", description = "知识库导入管理")
public class KnowledgeController {

    private final KnowledgeImportService knowledgeImportService;

    @PostMapping("/import")
    @Operation(summary = "导入知识库", description = "从种子数据文件导入知识到 knowledge_vectors 表")
    public ResponseEntity<Result<String>> importKnowledge() {
        int count = knowledgeImportService.importAll();
        return ResponseEntity.ok(Result.success("导入完成，共处理 " + count + " 条知识"));
    }
}
