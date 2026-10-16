import { useEffect, useState } from 'react';
import type { FiveStepResult } from '../shared/models';

interface StepDefinition {
  number: 1 | 2 | 3 | 4 | 5;
  key: keyof FiveStepResult;
  title: string;
  description: string;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { number: 1, key: 'step1Intent', title: '意图识别', description: '判断诉求、情绪与隐藏需求' },
  { number: 2, key: 'step2Strategy', title: '回复策略', description: '明确解决路径与沟通方式' },
  { number: 3, key: 'step3Script', title: '推荐话术', description: '客服审核后可直接复制使用' },
  { number: 4, key: 'step4Hook', title: '钩子引导', description: '补充客户可能关心的价值信息' },
  { number: 5, key: 'step5Close', title: '成功收尾', description: '自然结束并保留继续沟通空间' },
];

// 客服 90% 的注意力只需要"能直接发出去的那段话"，所以推荐话术常驻展开并置于顶部，
// 其余四步是审核与学习用的上下文，默认收起，需要时再展开。
const PRIMARY_STEP = STEP_DEFINITIONS[2];
const SUPPORTING_STEPS = STEP_DEFINITIONS.filter((step) => step.number !== 3);

interface GeneratePanelProps {
  result: FiveStepResult | null;
  loading: boolean;
  error: string;
  favoriteSteps: Set<number>;
  pendingFavoriteSteps: Set<number>;
  onRetry: () => void;
  onCopyStep3: () => void;
  onFavorite: (step: StepDefinition) => void;
}

export function GeneratePanel({
  result,
  loading,
  error,
  favoriteSteps,
  pendingFavoriteSteps,
  onRetry,
  onCopyStep3,
  onFavorite,
}: GeneratePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // 重新生成后回到"只展开推荐话术"的初始状态，避免上一轮展开项残留。
  useEffect(() => {
    setExpandedSteps(new Set());
  }, [result]);

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((current) => {
      const next = new Set(current);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const renderFavoriteButton = (step: StepDefinition) => {
    const isFavorite = favoriteSteps.has(step.number);
    const isPending = pendingFavoriteSteps.has(step.number);

    return (
      <button
        type="button"
        className={`favorite-button${isFavorite ? ' is-favorite' : ''}`}
        disabled={isFavorite || isPending}
        onClick={() => onFavorite(step)}
        aria-label={`${isFavorite ? '已收藏' : '收藏'}${step.title}`}
      >
        <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
        {isPending ? '收藏中' : isFavorite ? '已收藏' : '收藏'}
      </button>
    );
  };

  if (loading) {
    return (
      <section className="result-section" aria-busy="true" aria-label="AI 正在生成五步建议">
        <div className="section-heading">
          <div>
            <p className="eyebrow">五步生成法</p>
            <h2>AI 正在整理建议</h2>
          </div>
          <span className="loading-dot" aria-hidden="true" />
        </div>
        <div className="step-list">
          {STEP_DEFINITIONS.map((step) => (
            <div className="step-card skeleton-card" key={step.number}>
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="result-section error-state" role="alert">
        <span className="error-icon" aria-hidden="true">
          !
        </span>
        <h2>这次没有生成成功</h2>
        <p>{error}</p>
        <button type="button" className="secondary-button" onClick={onRetry}>
          重新生成
        </button>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="result-section empty-state">
        <span className="empty-illustration" aria-hidden="true">
          AI
        </span>
        <h2>五步建议会显示在这里</h2>
        <p>选中客户消息后按 Ctrl+Shift+F（macOS 为 Command+Shift+F），或直接在上方输入。</p>
      </section>
    );
  }

  return (
    <section className="result-section" aria-labelledby="five-step-title">
      <div className="section-heading result-heading">
        <div>
          <p className="eyebrow">五步生成法</p>
          <h2 id="five-step-title">AI 回复建议</h2>
        </div>
        <button type="button" className="copy-button" onClick={onCopyStep3}>
          复制推荐话术
        </button>
      </div>

      <article className="step-card step-3 step-primary">
        <div className="step-card-header">
          <div className="step-title-wrap">
            <span className="step-number">{PRIMARY_STEP.number}</span>
            <div>
              <h3>
                {PRIMARY_STEP.title}
                <span className="step-tag">可直接发送</span>
              </h3>
              <p>{PRIMARY_STEP.description}</p>
            </div>
          </div>
          {renderFavoriteButton(PRIMARY_STEP)}
        </div>
        <p className="step-content step-content-primary">{result[PRIMARY_STEP.key]}</p>
        <button type="button" className="secondary-button step-copy-inline" onClick={onCopyStep3}>
          复制这段话术
        </button>
      </article>

      <p className="step-list-label">生成依据（点击展开）</p>

      <div className="step-list">
        {SUPPORTING_STEPS.map((step) => {
          const isOpen = expandedSteps.has(step.number);
          const contentId = `step-content-${step.number}`;

          return (
            <article
              className={`step-card step-${step.number} step-collapsible${isOpen ? ' is-open' : ''}`}
              key={step.number}
            >
              <div className="step-card-header">
                <button
                  type="button"
                  className="step-toggle"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleStep(step.number)}
                >
                  <span className="step-number">{step.number}</span>
                  <span className="step-toggle-copy">
                    <span className="step-toggle-title">{step.title}</span>
                    <span className="step-toggle-description">{step.description}</span>
                  </span>
                  <span className="step-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </button>
                {renderFavoriteButton(step)}
              </div>
              {isOpen && (
                <p className="step-content" id={contentId}>
                  {result[step.key]}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export type { StepDefinition };
