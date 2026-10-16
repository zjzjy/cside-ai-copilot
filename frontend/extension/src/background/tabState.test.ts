import { describe, expect, it } from 'vitest';
import type { StoreContext, TabState } from '../shared/models';
import { mergeTabStatePatch, TabStateCoordinator } from './tabState';

const manualContext: StoreContext = {
  brand: 'vivo',
  platform: 'taobao',
  storeId: 'vivo-taobao-flagship',
  storeName: 'vivo旗舰店（淘宝）',
  source: 'manual',
  confirmed: true,
};

const automaticContext = (url: string): StoreContext => ({
  brand: 'huawei',
  platform: 'taobao',
  storeId: '10086',
  storeName: '页面推断店铺',
  source: 'auto',
  confirmed: false,
  url,
});

describe('tab state patch merging', () => {
  it('binds a URL-less manual choice to the first automatic page update', () => {
    const patch = mergeTabStatePatch(
      { pageContext: manualContext },
      { pageContext: automaticContext('https://qn.taobao.com/chat') },
    );

    expect(patch.pageContext).toEqual({
      ...manualContext,
      url: 'https://qn.taobao.com/chat',
    });
  });

  it('allows automatic context to replace a manual choice after navigation', () => {
    const patch = mergeTabStatePatch(
      { pageContext: { ...manualContext, url: 'https://qn.taobao.com/chat?a=1' } },
      { pageContext: automaticContext('https://qn.taobao.com/chat?a=2') },
    );

    expect(patch.pageContext).toEqual(automaticContext('https://qn.taobao.com/chat?a=2'));
  });
});

describe('TabStateCoordinator', () => {
  it('removes state after an in-flight update when the tab closes', async () => {
    const stored = new Map<number, TabState>();
    let releaseWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let confirmWriteStarted: (() => void) | undefined;
    const writing = new Promise<void>((resolve) => {
      confirmWriteStarted = resolve;
    });
    const coordinator = new TabStateCoordinator({
      read: async (tabId) => stored.get(tabId) ?? {},
      write: async (tabId, state) => {
        confirmWriteStarted?.();
        await writeStarted;
        stored.set(tabId, state);
      },
      remove: async (tabId) => {
        stored.delete(tabId);
      },
      notify: async () => undefined,
    });

    const update = coordinator.enqueue(7, {
      capturedSelection: {
        text: '客户消息',
        pageUrl: 'https://qn.taobao.com/chat',
        capturedAt: '2026-07-21T00:00:00.000Z',
      },
    });
    await writing;
    const cleanup = coordinator.close(7);
    releaseWrite?.();
    await Promise.all([update, cleanup]);

    expect(stored.has(7)).toBe(false);
  });
});
