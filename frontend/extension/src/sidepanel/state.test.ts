import { describe, expect, it } from 'vitest';
import type { StoreContext } from '../shared/models';
import { createRequestGate, isContextComplete, isSameStoreContext } from './state';

const context = (overrides: Partial<StoreContext> = {}): StoreContext => ({
  brand: 'vivo',
  platform: 'taobao',
  storeId: 'vivo-taobao-flagship',
  storeName: 'vivo旗舰店（淘宝）',
  source: 'manual',
  confirmed: true,
  ...overrides,
});

describe('store context identity', () => {
  it('uses storeId when either context has one', () => {
    expect(isSameStoreContext(context(), context())).toBe(true);
    expect(isSameStoreContext(context(), context({ storeId: 'another-store' }))).toBe(false);
    expect(isSameStoreContext(context(), context({ storeId: '' }))).toBe(false);
  });

  it('falls back to storeName only when both store IDs are missing', () => {
    expect(
      isSameStoreContext(context({ storeId: '' }), context({ storeId: '', storeName: '另一家店' })),
    ).toBe(false);
    expect(isSameStoreContext(context({ storeId: '' }), context({ storeId: '' }))).toBe(true);
  });

  it('requires a confirmed brand, platform and store ID before generation', () => {
    expect(isContextComplete(context())).toBe(true);
    expect(isContextComplete(context({ brand: 'unknown' }))).toBe(false);
    expect(isContextComplete(context({ platform: 'unknown' }))).toBe(false);
    expect(isContextComplete(context({ storeId: '' }))).toBe(false);
    expect(isContextComplete(context({ source: 'auto', confirmed: false }))).toBe(false);
  });
});

describe('generation request gate', () => {
  it('rejects old responses after a newer request starts or state is invalidated', () => {
    const gate = createRequestGate();
    const firstRequest = gate.next();
    const secondRequest = gate.next();

    expect(gate.isCurrent(firstRequest)).toBe(false);
    expect(gate.isCurrent(secondRequest)).toBe(true);

    gate.invalidate();
    expect(gate.isCurrent(secondRequest)).toBe(false);
  });
});
