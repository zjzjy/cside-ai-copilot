import { describe, expect, it } from 'vitest';
import { hasPageSnapshotChanged } from './urlWatcher';

describe('page snapshot change detection', () => {
  const current = {
    url: 'https://qn.taobao.com/chat?shopId=10086',
    title: 'vivo旗舰店 | 千牛接待台',
  };

  it('detects SPA navigation when the URL changes', () => {
    expect(
      hasPageSnapshotChanged(current, {
        ...current,
        url: 'https://qn.taobao.com/chat?shopId=10010',
      }),
    ).toBe(true);
  });

  it('detects an internal store switch when only the title changes', () => {
    expect(
      hasPageSnapshotChanged(current, {
        ...current,
        title: '华为旗舰店 | 千牛接待台',
      }),
    ).toBe(true);
  });

  it('does not publish duplicate context for an unchanged page', () => {
    expect(hasPageSnapshotChanged(current, current)).toBe(false);
  });
});
