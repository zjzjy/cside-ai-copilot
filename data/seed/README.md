# 种子数据说明

## 目录结构

```
data/seed/
├── common/                         # 通用层（全矩阵共享，~80%）
│   ├── scripts.json                # 通用话术模板（20条，按场景分类）
│   └── platform-policies.json      # 平台公共政策（淘宝/京东/拼多多/抖音）
├── brands/                         # 品牌层（按品牌隔离，~15%）
│   ├── vivo/
│   │   ├── brand-config.json       # 品牌话术风格 + 禁用语
│   │   ├── products.json           # 商品SKU（5款） MVP阶段2个品牌
│   │   ├── faq.json                # 品牌FAQ（15对）
│   │   └── scripts.json            # 品牌话术模板（5套五步）
│   └── huawei/
│       ├── brand-config.json
│       ├── products.json           # 商品SKU（5款）
│       ├── faq.json                # 品牌FAQ（10对）
│       └── scripts.json            # 品牌话术模板（3套五步）
└── stores/                         # 店铺层（仅差异，~5%）
    └── vivo-taobao-promo.json      # vivo旗舰店-淘宝促销活动
```

## 三级继承示例

当CS在 **vivo旗舰店-淘宝** 触发生成时：

1. 店铺层检索 → `vivo-taobao-promo.json`（618活动、学生优惠）
2. 品牌层检索 → `vivo/` 下所有文件（品牌FAQ + 话术模板 + 商品参数 + 禁用语过滤）
3. 通用层检索 → `common/` 下所有文件（通用话术 + 平台公共政策）

检索结果按 店铺 > 品牌 > 通用 优先级合并，品牌禁用语自动过滤。

## 数据格式约定

- 品牌层 JSON 必须包含 `"brand"` 和 `"level"` 字段，用于检索时的品牌过滤
- 通用层 JSON 必须包含 `"level": "common"`
- 所有话术/FAQ 必须包含 `"tags"` 数组，至少包含场景分类标签
