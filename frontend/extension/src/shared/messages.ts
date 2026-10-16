import type { StoreContext, TabState } from './models';

export interface SelectionPayload {
  text: string;
  pageUrl: string;
  capturedAt: string;
}

export type ExtensionMessage =
  | { type: 'CAPTURE_SELECTION' }
  | { type: 'SELECTION_CAPTURED'; payload: SelectionPayload }
  | { type: 'PAGE_CONTEXT_CHANGED'; payload: StoreContext }
  | { type: 'SET_MANUAL_CONTEXT'; payload: { tabId: number; context: StoreContext } }
  | { type: 'TAB_STATE_UPDATED'; payload: { tabId: number; patch: TabState } }
  | { type: 'CAPTURE_FAILED'; payload: { tabId: number; reason: string } };
