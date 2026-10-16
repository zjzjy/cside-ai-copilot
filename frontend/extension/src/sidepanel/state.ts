import type { StoreContext } from '../shared/models';

export const isContextComplete = (context: StoreContext) =>
  context.confirmed &&
  context.brand !== 'unknown' &&
  context.platform !== 'unknown' &&
  Boolean(context.storeId);

export const isSameStoreContext = (left: StoreContext, right: StoreContext) => {
  if (left.brand !== right.brand || left.platform !== right.platform) {
    return false;
  }

  if (left.storeId || right.storeId) {
    return left.storeId === right.storeId;
  }

  return left.storeName === right.storeName;
};

export interface RequestGate {
  next: () => number;
  invalidate: () => void;
  isCurrent: (requestId: number) => boolean;
}

export const createRequestGate = (): RequestGate => {
  let currentRequestId = 0;

  return {
    next: () => {
      currentRequestId += 1;
      return currentRequestId;
    },
    invalidate: () => {
      currentRequestId += 1;
    },
    isCurrent: (requestId) => requestId === currentRequestId,
  };
};
