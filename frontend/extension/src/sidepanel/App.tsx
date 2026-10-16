import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, customerServiceApi, isUsingRealApi } from '../api';
import { parseContextParams, toStoreContext } from '../shared/contextParams';
import type { ExtensionMessage } from '../shared/messages';
import type { FiveStepResult, KnowledgeChunk, StoreContext, TabState } from '../shared/models';
import { isDemoMode } from '../shared/demoMode';
import { GeneratePanel, type StepDefinition } from './GeneratePanel';
import { RagChunksPanel } from './RagChunksPanel';
import { createRequestGate, isContextComplete, isSameStoreContext } from './state';
import { BRAND_LABELS, PLATFORM_LABELS, StoreSwitcher, UNKNOWN_CONTEXT } from './StoreSwitcher';
import './App.css';

const hasExtensionApi = () =>
  typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id) && Boolean(chrome.storage?.session);

export function App() {
  // 以普通网页形态打开（本地演示页 / GitHub Pages 在线演示）时进入演示模式：
  // 不探测后端、不显示登录卡片，直接用 Mock API 跑通全流程。
  const demoMode = useMemo(() => isDemoMode(window.location.search, hasExtensionApi()), []);
  const [context, setContext] = useState<StoreContext>(UNKNOWN_CONTEXT);
  const [customerMessage, setCustomerMessage] = useState('');
  const [resultCustomerMessage, setResultCustomerMessage] = useState('');
  const [result, setResult] = useState<FiveStepResult | null>(null);
  const [conversationId, setConversationId] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [favoriteSteps, setFavoriteSteps] = useState<Set<number>>(new Set());
  const [pendingFavoriteSteps, setPendingFavoriteSteps] = useState<Set<number>>(new Set());
  const [ragChunks, setRagChunks] = useState<KnowledgeChunk[]>([]);
  const [apiMode, setApiMode] = useState<'checking' | 'mock' | 'real'>(
    demoMode ? 'mock' : 'checking',
  );
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const contextRef = useRef<StoreContext>(UNKNOWN_CONTEXT);
  const activeTabIdRef = useRef<number | undefined>(undefined);
  const tabStateRevisionRef = useRef(0);
  const generationRequestGateRef = useRef(createRequestGate());
  const stateVersionRef = useRef(0);

  const resetGeneratedState = useCallback(() => {
    generationRequestGateRef.current.invalidate();
    stateVersionRef.current += 1;
    setResult(null);
    setResultCustomerMessage('');
    setConversationId(undefined);
    setLoading(false);
    setError('');
    setFavoriteSteps(new Set());
    setPendingFavoriteSteps(new Set());
    setRagChunks([]);
  }, []);

  const applyContext = useCallback(
    (nextContext: StoreContext) => {
      const previousContext = contextRef.current;
      const storeChanged =
        !isSameStoreContext(previousContext, nextContext) ||
        (previousContext.confirmed && !nextContext.confirmed);

      contextRef.current = nextContext;
      setContext(nextContext);
      if (storeChanged) {
        setCustomerMessage('');
        resetGeneratedState();
      }
    },
    [resetGeneratedState],
  );

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(''), 2_800);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    let cancelled = false;

    const tryAutoLogin = async () => {
      if (isUsingRealApi()) {
        if (!cancelled) setApiMode('real');
        return;
      }

      try {
        const res = await fetch('http://localhost:8181/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        const body = await res.json();
        if (!cancelled) {
          if (body.code === 0 && body.data?.token) {
            localStorage.setItem('cside_token', body.data.token);
            localStorage.setItem('cside_use_real_api', 'true');
            setApiMode('real');
          } else {
            setApiMode('mock');
          }
        }
      } catch {
        if (!cancelled) setApiMode('mock');
      }
    };

    void tryAutoLogin();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  // 扩展形态下店铺上下文来自 content script；普通网页形态（演示页）下
  // 由页面自己的 URL 参数声明，效果一致：打开即带好品牌/平台/店铺。
  useEffect(() => {
    if (hasExtensionApi()) {
      return;
    }

    const declared = parseContextParams(window.location.search);
    if (!declared) {
      return;
    }

    applyContext(toStoreContext(declared, UNKNOWN_CONTEXT));
  }, [applyContext]);

  const handleToggleApi = async () => {
    if (apiMode === 'real') {
      localStorage.removeItem('cside_token');
      localStorage.removeItem('cside_use_real_api');
      setApiMode('mock');
      resetGeneratedState();
      setNotice('已切换到 Mock API');
      return;
    }

    await connectRealApi();
  };

  const connectRealApi = async () => {
    setApiMode('checking');
    try {
      const res = await fetch('http://localhost:8181/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const body = await res.json();
      if (body.code === 0 && body.data?.token) {
        localStorage.setItem('cside_token', body.data.token);
        localStorage.setItem('cside_use_real_api', 'true');
        setApiMode('real');
        resetGeneratedState();
        setNotice('已连接到真实 LLM API（DeepSeek V4 Flash）');
      } else {
        setApiMode('mock');
        setNotice('登录失败：' + (body.message || '用户名或密码错误'));
      }
    } catch {
      setApiMode('mock');
      setNotice('后端不可达，请确认已运行 start.bat');
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    await connectRealApi();
    setLoginLoading(false);
  };

  useEffect(() => {
    if (!hasExtensionApi()) {
      return;
    }

    const applyTabPatch = (patch: TabState) => {
      const { capturedSelection, pageContext } = patch;
      if (pageContext) {
        applyContext(pageContext);
      }
      if (capturedSelection) {
        if (capturedSelection.text) {
          setCustomerMessage(capturedSelection.text);
          resetGeneratedState();
          setNotice('已接收页面选中的客户消息');
        } else {
          setCustomerMessage('');
          resetGeneratedState();
          setNotice('没有读取到选中文字，请先选中客户消息');
        }
      }
    };

    const handleMessage = (message: ExtensionMessage) => {
      if (
        message.type === 'TAB_STATE_UPDATED' &&
        message.payload.tabId === activeTabIdRef.current
      ) {
        tabStateRevisionRef.current += 1;
        applyTabPatch(message.payload.patch);
      }

      if (message.type === 'CAPTURE_FAILED' && message.payload.tabId === activeTabIdRef.current) {
        setNotice(message.payload.reason);
      }
    };

    const loadActiveTabState = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) {
        return;
      }

      const tabChanged = activeTabIdRef.current !== tab.id;
      activeTabIdRef.current = tab.id;
      const loadRevision = tabStateRevisionRef.current + 1;
      tabStateRevisionRef.current = loadRevision;
      if (tabChanged) {
        setCustomerMessage('');
        applyContext(UNKNOWN_CONTEXT);
        resetGeneratedState();
      }

      const storageKey = `tabState:${tab.id}`;
      const stored = await chrome.storage.session.get(storageKey);
      if (activeTabIdRef.current !== tab.id || tabStateRevisionRef.current !== loadRevision) {
        return;
      }

      const tabState = stored[storageKey] as TabState | undefined;
      if (tabState?.pageContext) {
        applyContext(tabState.pageContext);
      }
      setCustomerMessage(tabState?.capturedSelection?.text ?? '');
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    void loadActiveTabState();

    const handleActivated = () => {
      void loadActiveTabState();
    };
    chrome.tabs.onActivated.addListener(handleActivated);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.tabs.onActivated.removeListener(handleActivated);
    };
  }, [applyContext, resetGeneratedState]);

  const handleContextChange = (nextContext: StoreContext) => {
    const manualContext = {
      ...nextContext,
      source: 'manual' as const,
      confirmed: true,
      url: contextRef.current.url,
    };
    applyContext(manualContext);
    setNotice(`已切换到${manualContext.storeName}`);
    const activeTabId = activeTabIdRef.current;
    if (hasExtensionApi() && activeTabId !== undefined) {
      void chrome.runtime.sendMessage({
        type: 'SET_MANUAL_CONTEXT',
        payload: { tabId: activeTabId, context: manualContext },
      } satisfies ExtensionMessage);
    }
  };

  const handleGenerate = useCallback(async () => {
    const trimmedMessage = customerMessage.trim();
    if (!trimmedMessage) {
      setError('请输入或选中客户消息后再生成。');
      return;
    }
    if (trimmedMessage.length > 500) {
      setError('客户消息不能超过 500 字，请精简后重试。');
      return;
    }
    if (!isContextComplete(context)) {
      setError('请先确认品牌、平台和店铺，避免把其他店铺的话术发给客户。');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    setFavoriteSteps(new Set());
    setPendingFavoriteSteps(new Set());
    stateVersionRef.current += 1;
    const requestId = generationRequestGateRef.current.next();

    try {
      const response = await customerServiceApi.generateReply({
        customerMessage: trimmedMessage,
        conversationId: conversationId,
        brand: context.brand,
        platform: context.platform,
        storeId: context.storeId,
      });
      if (!generationRequestGateRef.current.isCurrent(requestId)) {
        return;
      }
      // Skip storeId check for real API (backend store IDs differ from client constants)
      const api = localStorage.getItem('cside_use_real_api') === 'true';
      if (
        response.data.brand !== context.brand ||
        response.data.platform !== context.platform ||
        (!api && response.data.storeId !== context.storeId)
      ) {
        throw new ApiError(2002, '生成结果的店铺上下文不一致，请重试。');
      }
      setResult(response.data.fiveStep);
      setResultCustomerMessage(trimmedMessage);
      setConversationId(response.data.conversationId);
      setRagChunks(response.data.retrievedChunks ?? []);
    } catch (caughtError) {
      if (!generationRequestGateRef.current.isCurrent(requestId)) {
        return;
      }
      const message =
        caughtError instanceof ApiError
          ? `[${caughtError.code}] ${caughtError.message}`
          : '发生未知错误，请稍后重试。';
      setResult(null);
      setError(message);
    } finally {
      if (generationRequestGateRef.current.isCurrent(requestId)) {
        setLoading(false);
      }
    }
  }, [context, conversationId, customerMessage]);

  const handleCopyStep3 = async () => {
    if (!result?.step3Script) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.step3Script);
      setNotice('推荐话术已复制，请核对后再发送');
    } catch {
      setNotice('复制失败，请手动选择推荐话术');
    }
  };

  const handleFavorite = async (step: StepDefinition) => {
    if (!result || !resultCustomerMessage || favoriteSteps.has(step.number)) {
      return;
    }

    const stateVersion = stateVersionRef.current;
    setPendingFavoriteSteps((current) => new Set(current).add(step.number));
    try {
      await customerServiceApi.saveCollection({
        stepType: String(step.number) as '1' | '2' | '3' | '4' | '5',
        content: result[step.key],
        conversationId: conversationId,
        customerMessage: resultCustomerMessage,
      });
      if (stateVersionRef.current !== stateVersion) {
        return;
      }
      setFavoriteSteps((current) => new Set(current).add(step.number));
      setNotice(`已收藏第 ${step.number} 步：${step.title}`);
    } catch (caughtError) {
      if (stateVersionRef.current !== stateVersion) {
        return;
      }
      const message = caughtError instanceof ApiError ? caughtError.message : '收藏失败，请重试';
      setNotice(message);
    } finally {
      if (stateVersionRef.current === stateVersion) {
        setPendingFavoriteSteps((current) => {
          const next = new Set(current);
          next.delete(step.number);
          return next;
        });
      }
    }
  };

  const messageTooLong = customerMessage.length > 500;
  const contextIncomplete = !isContextComplete(context);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          AI
        </div>
        <div className="brand-copy">
          <h1>CSide</h1>
          <p>智能客服助手</p>
        </div>
        <button
          type="button"
          className={`service-status ${apiMode}`}
          onClick={() => void handleToggleApi()}
          disabled={apiMode === 'checking'}
          title={
            apiMode === 'real'
              ? '点击切换到 Mock API'
              : apiMode === 'mock'
                ? '点击连接后端切换到真实 LLM API'
                : ''
          }
        >
          <span aria-hidden="true" />
          {apiMode === 'checking' ? '检测中…' : apiMode === 'real' ? '真实 API' : 'Mock'}
        </button>
      </header>

      {apiMode === 'mock' && !demoMode && (
        <form className="login-card" onSubmit={(e) => void handleLogin(e)}>
          <p className="eyebrow">连接后端</p>
          <h2 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink)' }}>
            登录以启用真实 LLM
          </h2>
          <div className="login-fields">
            <input
              className="login-input"
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="用户名"
              autoComplete="username"
            />
            <input
              className="login-input"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="密码"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="login-button"
              disabled={loginLoading || !loginUsername || !loginPassword}
            >
              {loginLoading ? '连接中…' : '登录并连接 LLM'}
            </button>
          </div>
        </form>
      )}

      <div className="context-summary" aria-live="polite">
        <span>{BRAND_LABELS[context.brand]}</span>
        <span className="summary-divider">/</span>
        <span>{PLATFORM_LABELS[context.platform]}</span>
        <span className="summary-divider">/</span>
        <strong>{context.storeName}</strong>
      </div>

      <StoreSwitcher context={context} onChange={handleContextChange} />

      <section className="message-card" aria-labelledby="customer-message-title">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">客户消息</p>
            <h2 id="customer-message-title">输入需要回复的内容</h2>
          </div>
          <kbd>Ctrl / ⌘ ⇧ F</kbd>
        </div>
        <textarea
          value={customerMessage}
          onChange={(event) => {
            setCustomerMessage(event.target.value);
            resetGeneratedState();
          }}
          placeholder="在客服页面选中客户消息后按快捷键，或在这里直接粘贴……"
          rows={5}
          aria-invalid={messageTooLong}
        />
        <div className="input-meta">
          <span className={messageTooLong ? 'validation-error' : ''}>
            {messageTooLong
              ? '已超过 500 字限制'
              : contextIncomplete
                ? '请先确认完整店铺上下文'
                : 'AI 内容仅供参考，发送前请人工核对'}
          </span>
          <span className={messageTooLong ? 'validation-error' : ''}>
            {customerMessage.length}/500
          </span>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={!customerMessage.trim() || messageTooLong || contextIncomplete || loading}
          onClick={() => void handleGenerate()}
        >
          {loading ? 'AI 正在生成中…' : '生成五步建议'}
        </button>
        <p className="mock-hint">
          {apiMode === 'real' ? (
            '已连接真实 LLM API（DeepSeek V4 Flash），AI 内容仅供参考'
          ) : apiMode === 'mock' ? (
            <>
              当前使用 Mock API；输入 <code>#mock-error</code> 可验证失败与重试状态
            </>
          ) : (
            '正在检测后端服务…'
          )}
        </p>
      </section>

      <GeneratePanel
        result={result}
        loading={loading}
        error={error}
        favoriteSteps={favoriteSteps}
        pendingFavoriteSteps={pendingFavoriteSteps}
        onRetry={() => void handleGenerate()}
        onCopyStep3={() => void handleCopyStep3()}
        onFavorite={(step) => void handleFavorite(step)}
      />

      <RagChunksPanel chunks={ragChunks} />

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </main>
  );
}
