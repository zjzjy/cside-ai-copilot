import type { Brand, Platform, StoreContext } from '../shared/models';

export const STORE_OPTIONS: StoreContext[] = [
  {
    brand: 'vivo',
    platform: 'taobao',
    storeId: 'vivo-taobao-flagship',
    storeName: 'vivo旗舰店（淘宝）',
    source: 'manual',
    confirmed: true,
  },
  {
    brand: 'vivo',
    platform: 'jd',
    storeId: 'vivo-jd-flagship',
    storeName: 'vivo京东自营旗舰店',
    source: 'manual',
    confirmed: true,
  },
  {
    brand: 'huawei',
    platform: 'taobao',
    storeId: 'huawei-taobao-flagship',
    storeName: '华为旗舰店（淘宝）',
    source: 'manual',
    confirmed: true,
  },
  {
    brand: 'huawei',
    platform: 'jd',
    storeId: 'huawei-jd-flagship',
    storeName: '华为京东自营旗舰店',
    source: 'manual',
    confirmed: true,
  },
  {
    brand: 'oppo',
    platform: 'pdd',
    storeId: 'oppo-pdd-flagship',
    storeName: 'OPPO旗舰店（拼多多）',
    source: 'manual',
    confirmed: true,
  },
  {
    brand: 'xiaomi',
    platform: 'douyin',
    storeId: 'xiaomi-douyin-flagship',
    storeName: '小米官方旗舰店（抖音）',
    source: 'manual',
    confirmed: true,
  },
];

export const UNKNOWN_CONTEXT: StoreContext = {
  brand: 'unknown',
  platform: 'unknown',
  storeId: '',
  storeName: '请选择店铺',
  source: 'auto',
  confirmed: false,
};

const BRAND_LABELS: Record<Brand, string> = {
  vivo: 'vivo',
  huawei: '华为',
  oppo: 'OPPO',
  xiaomi: '小米',
  unknown: '未识别',
};

const PLATFORM_LABELS: Record<Platform, string> = {
  taobao: '淘宝 / 天猫',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖音',
  unknown: '未识别',
};

interface StoreSwitcherProps {
  context: StoreContext;
  onChange: (context: StoreContext) => void;
}

const pickStore = (brand: Brand, platform?: Platform) =>
  STORE_OPTIONS.find(
    (store) => store.brand === brand && (!platform || store.platform === platform),
  ) ?? STORE_OPTIONS.find((store) => store.brand === brand);

export function StoreSwitcher({ context, onChange }: StoreSwitcherProps) {
  const availablePlatforms = Array.from(
    new Set(
      STORE_OPTIONS.filter(
        (store) => context.brand === 'unknown' || store.brand === context.brand,
      ).map((store) => store.platform),
    ),
  );
  const availableStores = STORE_OPTIONS.filter(
    (store) => store.brand === context.brand && store.platform === context.platform,
  );

  const handleBrandChange = (brand: Brand) => {
    const nextStore = pickStore(brand, context.platform);
    if (nextStore) {
      onChange({ ...nextStore, source: 'manual', confirmed: true });
      return;
    }

    onChange({ ...context, brand, source: 'manual', confirmed: false });
  };

  const handlePlatformChange = (platform: Platform) => {
    const nextStore = pickStore(context.brand, platform);
    if (nextStore) {
      onChange({ ...nextStore, source: 'manual', confirmed: true });
      return;
    }

    onChange({ ...context, platform, source: 'manual', confirmed: false });
  };

  const handleStoreChange = (storeId: string) => {
    const nextStore = STORE_OPTIONS.find((store) => store.storeId === storeId);
    if (nextStore) {
      onChange({ ...nextStore, source: 'manual', confirmed: true });
    }
  };

  return (
    <section className="context-card" aria-labelledby="store-context-title">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">当前服务上下文</p>
          <h2 id="store-context-title">品牌与店铺</h2>
        </div>
        <span className={`source-badge source-${context.source}`}>
          {context.source === 'auto' ? '自动识别' : '手动选择'}
        </span>
      </div>

      <div className="context-grid">
        <label>
          <span>品牌</span>
          <select
            value={context.brand}
            onChange={(event) => handleBrandChange(event.target.value as Brand)}
          >
            {context.brand === 'unknown' && <option value="unknown">未识别</option>}
            {(['vivo', 'huawei', 'oppo', 'xiaomi'] as Brand[]).map((brand) => (
              <option key={brand} value={brand}>
                {BRAND_LABELS[brand]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>平台</span>
          <select
            value={context.platform}
            onChange={(event) => handlePlatformChange(event.target.value as Platform)}
          >
            {context.platform === 'unknown' && <option value="unknown">未识别</option>}
            {availablePlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABELS[platform]}
              </option>
            ))}
          </select>
        </label>

        <label className="store-field">
          <span>店铺</span>
          <select
            value={context.storeId}
            onChange={(event) => handleStoreChange(event.target.value)}
          >
            {!availableStores.some((store) => store.storeId === context.storeId) && (
              <option value={context.storeId}>{context.storeName}</option>
            )}
            {availableStores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export { BRAND_LABELS, PLATFORM_LABELS };
