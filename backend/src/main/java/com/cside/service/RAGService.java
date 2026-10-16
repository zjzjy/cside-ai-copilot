package com.cside.service;

import com.cside.config.EmbeddingProvider;
import com.cside.dto.KnowledgeChunk;
import com.cside.repository.KnowledgeVectorCandidate;
import com.cside.repository.KnowledgeVectorRepository;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * RAG 检索服务接口。
 *
 * <p>检索使用 BM25 与 pgvector 余弦相似度，并按店铺、品牌、通用三级继承加权；返回前执行品牌隔离和禁用语过滤。
 */
public interface RAGService {

    /**
     * 根据客户查询和当前业务上下文检索相关知识片段。
     *
     * @param query 非 {@code null}、非空的客户消息文本
     * @param brand 当前品牌，例如 {@code vivo}；可为 {@code null}，此时只查通用层
     * @param platform 当前平台，例如 {@code taobao}；可为 {@code null}
     * @param storeId 当前店铺 ID；可为 {@code null}
     * @return 不可变的相关知识片段列表，按混合分数降序排列，最多五条；不会包含其他品牌内容
     * @throws IllegalArgumentException query 为空时抛出
     */
    List<KnowledgeChunk> search(String query, String brand, String platform, String storeId);
}

/**
 * 基于 BM25、pgvector 余弦相似度和知识层级优先权的 RAG 检索实现。
 */
@Service
class HybridRAGService implements RAGService {

    private static final int RESULT_LIMIT = 5;
    private static final double BM25_WEIGHT = 0.75;
    private static final double VECTOR_WEIGHT = 0.20;
    private static final double BM25_K1 = 1.2;
    private static final double BM25_B = 0.75;
    private static final Pattern TOKEN_GROUP_PATTERN =
            Pattern.compile("[\\p{IsHan}]+|[a-z0-9]+");

    private final EmbeddingProvider embeddingProvider;
    private final KnowledgeVectorRepository repository;
    private final String queryInstruction;

    HybridRAGService(
            EmbeddingProvider embeddingProvider,
            KnowledgeVectorRepository repository,
            @Value("${cside.rag.query-instruction:为这个句子生成表示以用于检索相关文章：}")
                    String queryInstruction) {
        this.embeddingProvider = embeddingProvider;
        this.repository = repository;
        this.queryInstruction = queryInstruction == null ? "" : queryInstruction;
    }

    /** {@inheritDoc} */
    @Override
    public List<KnowledgeChunk> search(
            String query, String brand, String platform, String storeId) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("query must not be blank");
        }

        String normalizedBrand = normalizeOptional(brand);
        float[] queryEmbedding = embeddingProvider.embed(queryInstruction + query.trim());
        List<String> forbiddenWords = repository.findForbiddenWords(normalizedBrand);
        List<KnowledgeVectorCandidate> candidates = repository.findCandidates(
                normalizedBrand,
                normalizeOptional(platform),
                normalizeOptional(storeId),
                queryEmbedding);
        List<KnowledgeVectorCandidate> allowedCandidates = candidates.stream()
                .filter(candidate -> belongsToBrand(candidate, normalizedBrand))
                .filter(candidate -> !containsForbiddenWord(candidate.content(), forbiddenWords))
                .toList();
        if (allowedCandidates.isEmpty()) {
            return List.of();
        }

        List<String> queryTokens = tokenize(query);
        Bm25Corpus corpus = Bm25Corpus.from(allowedCandidates);
        List<ScoredCandidate> scoredCandidates = new ArrayList<>(allowedCandidates.size());
        double maxBm25 = 0.0;
        for (KnowledgeVectorCandidate candidate : allowedCandidates) {
            double bm25 = corpus.score(queryTokens, candidate);
            maxBm25 = Math.max(maxBm25, bm25);
            scoredCandidates.add(new ScoredCandidate(candidate, bm25));
        }

        double bm25Denominator = maxBm25 == 0.0 ? 1.0 : maxBm25;
        return scoredCandidates.stream()
                .map(candidate -> toKnowledgeChunk(candidate, bm25Denominator))
                .sorted((left, right) -> {
                    int scoreComparison = Double.compare(right.score(), left.score());
                    if (scoreComparison != 0) {
                        return scoreComparison;
                    }
                    return Integer.compare(levelPriority(right.level()), levelPriority(left.level()));
                })
                .limit(RESULT_LIMIT)
                .toList();
    }

    private KnowledgeChunk toKnowledgeChunk(
            ScoredCandidate scoredCandidate, double bm25Denominator) {
        KnowledgeVectorCandidate candidate = scoredCandidate.candidate();
        double normalizedBm25 = scoredCandidate.bm25() / bm25Denominator;
        double score = BM25_WEIGHT * normalizedBm25
                + VECTOR_WEIGHT * candidate.vectorScore()
                + levelBoost(candidate.level());
        return new KnowledgeChunk(
                candidate.sourceId(),
                candidate.sourceType(),
                candidate.level(),
                candidate.brand(),
                candidate.scene(),
                candidate.content(),
                Math.clamp(score, 0.0, 1.0));
    }

    private static boolean belongsToBrand(
            KnowledgeVectorCandidate candidate, String requestedBrand) {
        if ("common".equalsIgnoreCase(candidate.level())) {
            return true;
        }
        return requestedBrand != null
                && candidate.brand() != null
                && requestedBrand.equalsIgnoreCase(candidate.brand());
    }

    private static boolean containsForbiddenWord(String content, List<String> forbiddenWords) {
        if (content == null) {
            return false;
        }
        String normalizedContent = normalize(content);
        return forbiddenWords.stream()
                .filter(word -> word != null && !word.isBlank())
                .map(HybridRAGService::normalize)
                .anyMatch(normalizedContent::contains);
    }

    private static List<String> tokenize(String text) {
        String normalized = normalize(text);
        List<String> tokens = new ArrayList<>();
        Matcher matcher = TOKEN_GROUP_PATTERN.matcher(normalized);
        while (matcher.find()) {
            String group = matcher.group();
            if (group.codePoints().allMatch(HybridRAGService::isHan)) {
                int[] codePoints = group.codePoints().toArray();
                for (int index = 0; index < codePoints.length; index++) {
                    tokens.add(new String(codePoints, index, 1));
                    if (index + 1 < codePoints.length) {
                        tokens.add(new String(codePoints, index, 2));
                    }
                }
            } else {
                tokens.add(group);
            }
        }
        return tokens;
    }

    private static boolean isHan(int codePoint) {
        return Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT);
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static double levelBoost(String level) {
        return switch (level == null ? "" : level.toLowerCase(Locale.ROOT)) {
            case "store" -> 0.05;
            case "brand" -> 0.03;
            default -> 0.0;
        };
    }

    private static int levelPriority(String level) {
        return switch (level == null ? "" : level.toLowerCase(Locale.ROOT)) {
            case "store" -> 3;
            case "brand" -> 2;
            case "common" -> 1;
            default -> 0;
        };
    }

    private record ScoredCandidate(KnowledgeVectorCandidate candidate, double bm25) {}

    private record Bm25Corpus(
            Map<KnowledgeVectorCandidate, List<String>> documentTokens,
            Map<String, Integer> documentFrequency,
            double averageDocumentLength) {

        private static Bm25Corpus from(List<KnowledgeVectorCandidate> candidates) {
            Map<KnowledgeVectorCandidate, List<String>> documentTokens = new HashMap<>();
            Map<String, Integer> documentFrequency = new HashMap<>();
            int totalDocumentLength = 0;
            for (KnowledgeVectorCandidate candidate : candidates) {
                String searchableText = String.join(
                        " ",
                        valueOrEmpty(candidate.sourceType()),
                        valueOrEmpty(candidate.scene()),
                        valueOrEmpty(candidate.content()));
                List<String> tokens = tokenize(searchableText);
                documentTokens.put(candidate, tokens);
                totalDocumentLength += tokens.size();
                for (String token : new HashSet<>(tokens)) {
                    documentFrequency.merge(token, 1, Integer::sum);
                }
            }
            double averageLength = candidates.isEmpty()
                    ? 1.0
                    : (double) totalDocumentLength / candidates.size();
            return new Bm25Corpus(documentTokens, documentFrequency, averageLength);
        }

        private double score(List<String> queryTokens, KnowledgeVectorCandidate candidate) {
            List<String> tokens = documentTokens.getOrDefault(candidate, List.of());
            if (tokens.isEmpty() || queryTokens.isEmpty()) {
                return 0.0;
            }
            Map<String, Long> termFrequency = new HashMap<>();
            for (String token : tokens) {
                termFrequency.merge(token, 1L, Long::sum);
            }
            double score = 0.0;
            for (String queryToken : new HashSet<>(queryTokens)) {
                long frequency = termFrequency.getOrDefault(queryToken, 0L);
                if (frequency == 0L) {
                    continue;
                }
                int containingDocuments = documentFrequency.getOrDefault(queryToken, 0);
                double inverseDocumentFrequency = Math.log(
                        1.0 + (documentTokens.size() - containingDocuments + 0.5)
                                / (containingDocuments + 0.5));
                double denominator = frequency
                        + BM25_K1
                                * (1.0 - BM25_B
                                        + BM25_B * tokens.size() / averageDocumentLength);
                score += inverseDocumentFrequency
                        * frequency
                        * (BM25_K1 + 1.0)
                        / denominator;
            }
            return score;
        }

        private static String valueOrEmpty(String value) {
            return value == null ? "" : value;
        }
    }
}
