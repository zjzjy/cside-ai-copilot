# demo/ — 演示与素材

这个目录只做一件事：**让人不装插件、不连后端，也能看懂 CSide 在客服工作场景里是什么样**。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `mock-console.html` | 模拟的客服工作台（会话列表 / 聊天窗口 / 客户信息 / 订单卡片）。纯静态、无外部依赖，所有数据与品牌名均为虚构 |
| `index.html` | 并排演示页：左侧工作台 + 右侧 CSide 侧边栏（iframe 内嵌 `app/`）。页面顶部有醒目的“纯演示”声明，不绘制浏览器地址栏 |
| `app/` | 侧边栏的**静态构建产物**（由 `npm run build:demo` 生成），始终走 Mock API，不包含登录入口或后端地址 |

## 本地打开

```bash
# 在仓库根目录
python -m http.server 8088 --directory demo
# 然后访问
#   http://localhost:8088/index.html        并排演示
#   http://localhost:8088/mock-console.html  只打开模拟工作台（配合真实扩展使用）
```

> 用 `file://` 直接双击打开会受浏览器 iframe 限制，建议始终用一个静态服务器。

## 店铺上下文怎么来的

`mock-console.html` 的 URL 里带了一组参数：

```
?cside_brand=demo&cside_platform=demo&cside_store=demo-store&cside_store_name=示例品牌旗舰店（演示）
```

扩展的 content script 会优先读取这组参数来声明店铺上下文，所以打开页面后侧边栏就是正确的品牌 / 平台 / 店铺，不需要手动选。

这也是给**自建或内网客服后台**预留的接入方式：页面无法命中平台域名时，用 URL 参数显式声明即可。

## 演示模式

`demo/app` 是用 `vite.demo.config.ts` 单独构建的演示包，编译期就固定为演示模式。即使直接打开
`demo/app/index.html`、删掉 URL 里的 `cside_demo=1`，也不会显示登录框、不会探测本机后端，
只会使用 Mock API。开发服务器（`npm run dev`）下仍可用 `?cside_demo=1` 临时进入演示模式。

* 不探测本机后端、不显示登录卡片；
* 直接使用 Mock API 完成生成、收藏、复制全流程；
* 状态胶囊会显示 `Mock`，页面底部提示当前为 Mock 数据。

扩展形态（`chrome-extension://`）下永远走真实链路，不会进入演示模式。

## 安全与分享

这个目录是**产品演示**，不是淘宝/千牛/华为的官方后台：

* 不要在这里绘制浏览器标签栏、地址栏、锁图标或任何“官方登录”外观；
* 所有店铺、客户、订单、商品信息都应保持虚构；
* 演示包不包含真实 API 客户端、默认账号口令或 localhost 请求；
* 分享前优先使用自定义域名；`github.io` 是共享免费域名，容易被安全引擎按主机级别拦截。

## 重新生成 `app/` 与素材

```bash
cd frontend/extension
npm run build:demo                        # 重新构建 demo/app
node scripts/capture-demo.mjs --base http://127.0.0.1:8088 --out ../../docs/images
```

第二个命令会用 Playwright 自动跑一遍演示流程，输出 `docs/images/` 下的截图与 GIF。
