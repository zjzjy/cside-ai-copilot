import type { ExtensionMessage, SelectionPayload } from '../shared/messages';
import { detectPageContext } from './pageContext';
import { watchUrlChanges } from './urlWatcher';

const sendMessage = (message: ExtensionMessage) => {
  void chrome.runtime.sendMessage(message).catch(() => {
    // 扩展更新后旧页面的执行上下文可能失效，此时等待用户刷新页面即可。
  });
};

const getSelectedText = () => {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? 0;
    const selectedValue = activeElement.value.slice(start, end).trim();
    if (selectedValue) {
      return selectedValue;
    }
  }

  return window.getSelection()?.toString().trim() ?? '';
};

const publishPageContext = (url = window.location.href) => {
  sendMessage({
    type: 'PAGE_CONTEXT_CHANGED',
    payload: detectPageContext(url, document.title),
  });
};

const captureSelection = () => {
  const payload: SelectionPayload = {
    text: getSelectedText(),
    pageUrl: window.location.href,
    capturedAt: new Date().toISOString(),
  };

  sendMessage({ type: 'SELECTION_CAPTURED', payload });
  return payload;
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type !== 'CAPTURE_SELECTION') {
    return false;
  }

  const payload = captureSelection();
  sendResponse({ ok: Boolean(payload.text) });
  return false;
});

publishPageContext();
watchUrlChanges(publishPageContext);
