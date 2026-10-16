import { describe, expect, it } from 'vitest';
import { detectPageContext } from './pageContext';

describe('detectPageContext', () => {
  it('detects a vivo Taobao store from URL parameters', () => {
    const context = detectPageContext(
      'https://qn.taobao.com/chat?shopId=10086&shopName=vivo%E6%97%97%E8%88%B0%E5%BA%97',
      '千牛接待台',
    );

    expect(context).toMatchObject({
      platform: 'taobao',
      brand: 'vivo',
      storeId: '10086',
      storeName: 'vivo旗舰店',
      source: 'auto',
      confirmed: false,
    });
  });

  it('detects Huawei and JD from the page title and hostname', () => {
    const context = detectPageContext(
      'https://chat.jd.com/index',
      '华为京东自营旗舰店 | 客服工作台',
    );

    expect(context.platform).toBe('jd');
    expect(context.brand).toBe('huawei');
    expect(context.storeName).toBe('华为京东自营旗舰店');
  });

  it('returns an explicit unknown context for an invalid URL', () => {
    expect(detectPageContext('not-a-url')).toMatchObject({
      platform: 'unknown',
      brand: 'unknown',
      storeName: '未识别店铺',
    });
  });

  it('does not treat lookalike hostnames as supported platforms', () => {
    expect(detectPageContext('https://fake-taobao.com/chat').platform).toBe('unknown');
    expect(detectPageContext('https://eviljd.com/chat').platform).toBe('unknown');
  });

  it('does not infer a store brand from unrelated URL keywords', () => {
    const context = detectPageContext(
      'https://qn.taobao.com/chat?shopId=10086&keyword=huawei',
      '千牛接待台',
    );

    expect(context).toMatchObject({
      brand: 'unknown',
      platform: 'taobao',
      storeId: '10086',
      confirmed: false,
    });
  });

  it.each([
    ['https://mms.pinduoduo.com/chat', 'pdd'],
    ['https://fxg.jinritemai.com/ffa/mshop/homepage/index', 'douyin'],
    ['https://www.douyin.com/user/test', 'douyin'],
  ] as const)('maps %s to %s', (url, platform) => {
    expect(detectPageContext(url).platform).toBe(platform);
  });

  it('honours a context declared by the page through URL params', () => {
    const context = detectPageContext(
      'http://localhost:5174/demo/mock-console.html?cside_brand=huawei&cside_platform=taobao&cside_store=huawei-taobao-flagship&cside_store_name=%E5%8D%8E%E4%B8%BA%E6%97%97%E8%88%B0%E5%BA%97%EF%BC%88%E6%B7%98%E5%AE%9D%EF%BC%89',
      '客服工作台',
    );

    expect(context).toMatchObject({
      brand: 'huawei',
      platform: 'taobao',
      storeId: 'huawei-taobao-flagship',
      storeName: '华为旗舰店（淘宝）',
      source: 'auto',
      confirmed: true,
    });
  });

  it('stays unconfirmed when the declared params are incomplete', () => {
    const context = detectPageContext(
      'http://localhost:5174/chat?cside_brand=huawei',
      '客服工作台',
    );

    expect(context).toMatchObject({
      brand: 'huawei',
      platform: 'unknown',
      confirmed: false,
    });
  });
});
