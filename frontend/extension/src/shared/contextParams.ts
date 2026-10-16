import type { Brand, Platform, StoreContext } from './models';

/**
 * 页面可以通过 URL 参数显式声明店铺上下文。
 *
 * 千牛、京麦这类官方后台能用域名 + 标题自动识别，但自建/内网客服后台、
 * 以及本仓库的演示页面（demo/）没有平台域名，所以提供一个显式声明的通道：
 *
 *   ?cside_platform=taobao&cside_brand=huawei&cside_store=huawei-taobao-flagship
 *
 * 参数齐全时上下文直接标记为 confirmed，客服无需再手动选店铺。
 */
export const CONTEXT_PARAM_KEYS = {
  brand: 'cside_brand',
  platform: 'cside_platform',
  storeId: 'cside_store',
  storeName: 'cside_store_name',
} as const;

const BRANDS: Brand[] = ['vivo', 'huawei', 'oppo', 'xiaomi'];
const PLATFORMS: Platform[] = ['taobao', 'jd', 'pdd', 'douyin'];

export interface ContextParamOverride {
  brand?: Brand;
  platform?: Platform;
  storeId?: string;
  storeName?: string;
}

export const parseContextParams = (search: string): ContextParamOverride | null => {
  if (!search) {
    return null;
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const brandValue = params.get(CONTEXT_PARAM_KEYS.brand)?.trim().toLowerCase();
  const platformValue = params.get(CONTEXT_PARAM_KEYS.platform)?.trim().toLowerCase();
  const storeId = params.get(CONTEXT_PARAM_KEYS.storeId)?.trim();
  const storeName = params.get(CONTEXT_PARAM_KEYS.storeName)?.trim();

  const brand = BRANDS.find((item) => item === brandValue);
  const platform = PLATFORMS.find((item) => item === platformValue);

  if (!brand && !platform && !storeId && !storeName) {
    return null;
  }

  return { brand, platform, storeId: storeId || undefined, storeName: storeName || undefined };
};

export const toStoreContext = (
  override: ContextParamOverride,
  fallback: Pick<StoreContext, 'brand' | 'platform' | 'storeId' | 'storeName'>,
): StoreContext => {
  const brand = override.brand ?? fallback.brand;
  const platform = override.platform ?? fallback.platform;
  const storeId = override.storeId ?? fallback.storeId;
  const storeName = override.storeName ?? fallback.storeName;

  return {
    brand,
    platform,
    storeId,
    storeName,
    source: 'auto',
    confirmed: brand !== 'unknown' && platform !== 'unknown' && Boolean(storeId),
  };
};
