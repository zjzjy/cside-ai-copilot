import type { TabState } from '../shared/models';

export const mergeTabStatePatch = (currentState: TabState, partialState: TabState) => {
  const incomingContext = partialState.pageContext;
  const currentContext = currentState.pageContext;
  const samePageManualContext =
    incomingContext?.source === 'auto' &&
    currentContext?.source === 'manual' &&
    Boolean(incomingContext.url) &&
    incomingContext.url === currentContext.url;
  const firstPageForManualContext =
    incomingContext?.source === 'auto' &&
    currentContext?.source === 'manual' &&
    !currentContext.url &&
    Boolean(incomingContext.url);

  if (samePageManualContext || firstPageForManualContext) {
    return {
      ...partialState,
      pageContext: {
        ...currentContext,
        url: currentContext.url || incomingContext.url,
      },
    };
  }

  return partialState;
};

interface TabStateAdapters {
  read: (tabId: number) => Promise<TabState>;
  write: (tabId: number, state: TabState) => Promise<void>;
  remove: (tabId: number) => Promise<void>;
  notify: (tabId: number, patch: TabState) => Promise<void>;
}

export class TabStateCoordinator {
  private readonly queues = new Map<number, Promise<void>>();
  private readonly closedTabIds = new Set<number>();
  private readonly adapters: TabStateAdapters;

  constructor(adapters: TabStateAdapters) {
    this.adapters = adapters;
  }

  enqueue(tabId: number, partialState: TabState) {
    if (this.closedTabIds.has(tabId)) {
      return Promise.resolve();
    }

    const previousUpdate = this.queues.get(tabId) ?? Promise.resolve();
    const nextUpdate = previousUpdate
      .catch(() => undefined)
      .then(async () => {
        if (this.closedTabIds.has(tabId)) {
          return;
        }

        const currentState = await this.adapters.read(tabId);
        if (this.closedTabIds.has(tabId)) {
          return;
        }

        const effectivePatch = mergeTabStatePatch(currentState, partialState);
        await this.adapters.write(tabId, { ...currentState, ...effectivePatch });
        if (!this.closedTabIds.has(tabId)) {
          await this.adapters.notify(tabId, effectivePatch);
        }
      });

    this.track(tabId, nextUpdate);
    return nextUpdate;
  }

  close(tabId: number) {
    this.closedTabIds.add(tabId);
    const previousUpdate = this.queues.get(tabId) ?? Promise.resolve();
    const cleanup = previousUpdate.catch(() => undefined).then(() => this.adapters.remove(tabId));

    this.track(tabId, cleanup);
    return cleanup;
  }

  reopen(tabId: number) {
    this.closedTabIds.delete(tabId);
  }

  private track(tabId: number, task: Promise<void>) {
    this.queues.set(tabId, task);
    const release = () => {
      if (this.queues.get(tabId) === task) {
        this.queues.delete(tabId);
      }
    };
    void task.then(release, release);
  }
}
