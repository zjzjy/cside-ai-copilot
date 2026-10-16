package com.cside.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateResponse {
    private Long conversationId;
    private String brand;
    private String platform;
    private Map<String, String> fiveStep;
    private List<KnowledgeChunk> retrievedChunks;
}
