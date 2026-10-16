import type { ExtensionMessage, SelectionPayload } from '../shared/messages';
import type { StoreContext, TabState } from '../shared/models';
import { TabStateCoordinator } from './tabState';

const configureSidePanel = async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
};

const notifyExtension = async (message: ExtensionMessage) => {
  await chrome.runtime.sendMessage(message).catch(() => undefined);
};

void configureSidePanel().catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel().catch(() => undefined);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-selection') {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined) {
    return;
  }

  const capturePromise = chrome.tabs.sendMessage(tab.id, {
    type: 'CAPTURE_SELECTION',
  } satisfies ExtensionMessage);
  const openPanelPromise = chrome.sidePanel.open({ windowId: tab.windowId });
  const [captureResult, openPanelResult] = await Promise.allSettled([
    capturePromise,
    openPanelPromise,
  ]);

  if (captureResult.status === 'rejected') {
    await notifyExtension({
      type: 'CAPTURE_FAILED',
      payload: {
        tabId: tab.id,
        reason: '当前页面暂不支持读取选中文字，请手动粘贴客户消息。',
      },
    });
  }

  if (openPanelResult.status === 'rejected') {
    await notifyExtension({
      type: 'CAPTURE_FAILED',
      payload: {
        tabId: tab.id,
        reason: '侧边栏打开失败，请点击扩展图标后重试。',
      },
    });
  }
});

const tabStateCoordinator = new TabStateCoordinator({
  read: async (tabId) => {
    const storageKey = `tabState:${tabId}`;
    const stored = await chrome.storage.session.get(storageKey);
    return (stored[storageKey] as TabState | undefined) ?? {};
  },
  write: async (tabId, state) => {
    await chrome.storage.session.set({ [`tabState:${tabId}`]: state });
  },
  remove: async (tabId) => {
    await chrome.storage.session.remove(`tabState:${tabId}`);
  },
  notify: async (tabId, patch) => {
    await notifyExtension({
      type: 'TAB_STATE_UPDATED',
      payload: { tabId, patch },
    });
  },
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (message.type === 'SET_MANUAL_CONTEXT') {
    void tabStateCoordinator.enqueue(message.payload.tabId, {
      pageContext: message.payload.context,
    });
    return;
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return;
  }

  if (message.type === 'SELECTION_CAPTURED') {
    void tabStateCoordinator.enqueue(tabId, {
      capturedSelection: message.payload satisfies SelectionPayload,
    });
  }

  if (message.type === 'PAGE_CONTEXT_CHANGED') {
    void tabStateCoordinator.enqueue(tabId, {
      pageContext: message.payload satisfies StoreContext,
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void tabStateCoordinator.close(tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) {
    tabStateCoordinator.reopen(tab.id);
  }
});
