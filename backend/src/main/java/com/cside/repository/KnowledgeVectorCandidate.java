package com.cside.repository;

/**
 * 数据库返回的 RAG 候选知识片段。
 *
 * @param sourceId 来源业务 ID
 * @param sourceType 来源类型
 * @param level common、brand 或 store
 * @param brand 所属品牌，通用层为 {@code null}
 * @param scene 场景标签
 * @param content 原始知识文本
 * @param vectorScore pgvector 计算并归一化至 {@code [0, 1]} 的余弦相似度
 */
public record KnowledgeVectorCandidate(
        String sourceId,
        String sourceType,
        String level,
        String brand,
        String scene,
        String content,
        double vectorScore) {}
