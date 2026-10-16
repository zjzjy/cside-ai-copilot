package com.cside.dto;

/**
 * RAG 检索返回的知识片段。
 */
public record KnowledgeChunk(
    String sourceId,      // 来源ID（FAQ ID / 话术ID / 商品SKU）
    String sourceType,    // faq / script / product / common_script
    String level,         // common / brand / store
    String brand,         // 品牌标签（通用层为 null）
    String scene,         // 场景标签
    String content,       // 文本内容
    double score          // 相似度分数（0-1）
) {}
