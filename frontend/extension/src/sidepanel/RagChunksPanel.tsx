import { useEffect, useState } from 'react';
import type { KnowledgeChunk } from '../shared/models';

interface RagChunksPanelProps {
  chunks?: KnowledgeChunk[];
}

const LEVEL_LABELS: Record<string, string> = {
  common: '通用',
  brand: '品牌',
  store: '店铺',
};

const TYPE_LABELS: Record<string, string> = {
  faq: 'FAQ',
  script: '话术',
  product: '商品',
  common_script: '通用话术',
  policy: '政策',
};

function levelColor(level: string): string {
  switch (level) {
    case 'store':
      return '#f5222d';
    case 'brand':
      return '#fa8c16';
    default:
      return '#1890ff';
  }
}

export function RagChunksPanel({ chunks }: RagChunksPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 溯源默认收起：它是"这条话术凭什么这么说"的审计信息，
  // 只在客服需要核对或学习时才展开，不占据主流程的注意力。
  useEffect(() => {
    setIsOpen(false);
  }, [chunks]);

  if (!chunks || chunks.length === 0) {
    return null;
  }

  const top3 = chunks.slice(0, 3);

  return (
    <section
      className={`rag-section${isOpen ? ' is-open' : ''}`}
      aria-labelledby="rag-sources-title"
    >
      <button
        type="button"
        className="rag-toggle"
        aria-expanded={isOpen}
        aria-controls="rag-sources-body"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="rag-toggle-copy">
          <span className="eyebrow">溯源</span>
          <span className="rag-toggle-title" id="rag-sources-title">
            RAG 召回 Top-{top3.length}
          </span>
        </span>
        <span className="rag-toggle-meta">
          <span className="rag-toggle-hint">{isOpen ? '收起' : '查看依据'}</span>
          <span className="step-chevron" aria-hidden="true">
            ⌄
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="rag-chunks" id="rag-sources-body">
          {top3.map((chunk, idx) => (
            <article key={idx} className="rag-card">
              <div className="rag-card-header">
                <span className="rag-level-badge" style={{ background: levelColor(chunk.level) }}>
                  {LEVEL_LABELS[chunk.level] || chunk.level}
                </span>
                <span className="rag-type-badge">
                  {TYPE_LABELS[chunk.sourceType] || chunk.sourceType}
                </span>
                {chunk.scene && <span className="rag-scene">{chunk.scene}</span>}
                <span className="rag-score">{(chunk.score * 100).toFixed(0)}%</span>
              </div>
              <p className="rag-content">{chunk.content}</p>
              <div className="rag-source">
                {chunk.brand && <span>{chunk.brand} · </span>}
                <code>{chunk.sourceId}</code>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
