package com.cside.repository;

public record KnowledgeVectorInsert(
        String sourceId,
        String sourceType,
        String level,
        String brand,
        String platform,
        String category,
        String scene,
        String content,
        float[] embedding,
        String metadataJson) {}
