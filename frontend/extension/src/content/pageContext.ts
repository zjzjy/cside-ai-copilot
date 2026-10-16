import type { Brand, Platform, StoreContext } from '../shared/models';
import { parseContextParams, toStoreContext } from '../shared/contextParams';

const PLATFORM_HOSTS: Array<{ platform: Platform; hosts: string[] }> = [
  { platform: 'taobao', hosts: ['taobao.com', 'tmall.com'] },
  { platform: 'jd', hosts: ['jd.com'] },
  { platform: 'pdd', hosts: ['pinduoduo.com', 'yangkeduo.com'] },
  { platform: 'douyin', hosts: ['douyin.com', 'jinritemai.com'] },
];

const BRAND_PATTERNS: Array<{ brand: Brand; patterns: RegExp[] }> = [
  { brand: 'vivo', patterns: [/\bvivo\b/i, /维沃/] },
  { brand: 'huawei', patterns: [/\bhuawei\b/i, /华为/] },
  { brand: 'oppo', patterns: [/\boppo\b/i, /欧珀/] },
  { brand: 'xiaomi', patterns: [/\bxiaomi\b/i, /小米/] },
];

const STORE_QUERY_KEYS = ['storeId', 'store_id', 'shopId', 'shop_id', 'sellerId', 'seller_id'];
const STORE_NAME_KEYS = ['storeName', 'store_name', 'shopName', 'shop_name', 'sellerNick', 'nick'];

const findQueryValue = (url: URL, keys: string[]) => {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return '';
};

const detectPlatform = (hostname: string): Platform => {
  const match = PLATFORM_HOSTS.find(({ hosts }) =>
    hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
  return match?.platform ?? 'unknown';
};

const detectBrand = (source: string): Brand => {
  const match = BRAND_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(source)),
  );
  return match?.brand ?? 'unknown';
};

const cleanTitle = (title: string) =>
  title
    .split(/[|｜—_-]/)[0]
    ?.replace(/\s+/g, ' ')
    .trim() ?? '';

export const detectPageContext = (rawUrl: string, pageTitle = ''): StoreContext => {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return {
      brand: 'unknown',
      platform: 'unknown',
      storeId: '',
      storeName: '未识别店铺',
      source: 'auto',
      confirmed: false,
      url: rawUrl,
    };
  }

  // 页面显式声明优先：自建/内网客服后台、本地演示页没有平台域名，
  // 用 cside_* 参数声明上下文，跳过域名与标题猜测。
  const declared = parseContextParams(url.search);
  if (declared) {
    return {
      ...toStoreContext(declared, {
        brand: 'unknown',
        platform: 'unknown',
        storeId: '',
        storeName: cleanTitle(pageTitle) || '未识别店铺',
      }),
      url: url.href,
    };
  }

  const storeId = findQueryValue(url, STORE_QUERY_KEYS);
  const queryStoreName = findQueryValue(url, STORE_NAME_KEYS);
  const titleStoreName = cleanTitle(pageTitle);
  const storeName = queryStoreName || titleStoreName || '未识别店铺';
  const brandSource = `${queryStoreName} ${pageTitle}`;

  return {
    brand: detectBrand(brandSource),
    platform: detectPlatform(url.hostname.toLowerCase()),
    storeId,
    storeName,
    source: 'auto',
    confirmed: false,
    url: url.href,
  };
};
