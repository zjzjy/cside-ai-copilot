#!/usr/bin/env node
/**
 * 生成 README / release 用的演示素材（截图 + GIF）。
 *
 * 前置条件：
 *   1) 在仓库根目录起一个静态服务器指向 demo/（例如 python -m http.server 8088 --directory demo）
 *   2) frontend/extension 已 npm install，并执行过 npm run build:demo
 *
 * 用法：
 *   node scripts/capture-demo.mjs --base http://127.0.0.1:8088 --out ../../docs/images
 */
import { chromium } from '@playwright/test';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index].replace(/^--/, ''), process.argv[index + 1]);
}

const baseUrl = args.get('base') ?? 'http://127.0.0.1:8088';
const outDir = path.resolve(args.get('out') ?? '../../docs/images');
const frameDir = path.join(os.tmpdir(), `cside-demo-frames-${Date.now()}`);
const panelQuery =
  'cside_demo=1&cside_brand=huawei&cside_platform=taobao&cside_store=huawei-taobao-flagship' +
  '&cside_store_name=%E5%8D%8E%E4%B8%BA%E6%97%97%E8%88%B0%E5%BA%97%EF%BC%88%E6%B7%98%E5%AE%9D%EF%BC%89';
const customerMessage = '小米和联想的耳机哪个好？';

const log = (...message) => console.log('[capture]', ...message);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const offsetOf = (page, selector) =>
  page.evaluate((target) => {
    const element = document.querySelector(target);
    return element ? element.getBoundingClientRect().top + window.scrollY : 0;
  }, selector);

const scrollToY = (page, y) => page.evaluate((target) => window.scrollTo(0, target), y);

/** 分步滚动，让 GIF 里的滚动是"看得见"的动效而不是瞬移。 */
async function smoothScrollTo(page, y, steps = 4, onFrame) {
  const startY = await page.evaluate(() => window.scrollY);
  for (let index = 1; index <= steps; index += 1) {
    await scrollToY(page, startY + ((y - startY) * index) / steps);
    await wait(90);
    if (onFrame) await onFrame();
  }
}

async function preparePanel(page) {
  await page.goto(`${baseUrl}/app/index.html?${panelQuery}`, { waitUntil: 'load' });
  await page.waitForSelector('.app-shell');
  await page.waitForSelector('.context-summary');
}

async function typeCustomerMessage(page, onFrame) {
  const textarea = page.locator('textarea');
  await textarea.click();
  for (const char of customerMessage) {
    await textarea.type(char, { delay: 0 });
    if (onFrame) await onFrame();
    await wait(45);
  }
}

async function generate(page) {
  await page.locator('.primary-button').click();
  await page.waitForSelector('article.step-card.step-primary', { timeout: 15000 });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(frameDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--force-device-scale-factor=2', '--hide-scrollbars'],
  });

  // ---- 1. 并排演示（客服工作台 + 侧边栏）----
  const compositeContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const composite = await compositeContext.newPage();
  await composite.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
  const panelFrame = composite.frameLocator('iframe[title="CSide 侧边栏"]');
  await panelFrame.locator('.app-shell').waitFor();
  await composite.waitForTimeout(600);

  await panelFrame.locator('textarea').fill(customerMessage);
  await panelFrame.locator('.primary-button').click();
  await panelFrame.locator('article.step-card.step-primary').waitFor({ timeout: 15000 });
  // 侧边栏真实使用时是整屏高度，这里把 iframe 内部滚到推荐话术，保证首图就能看到结果
  const panelInnerFrame = composite
    .frames()
    .find((frame) => frame.url().includes('/app/index.html'));
  const resultTop = await panelInnerFrame.evaluate(() => {
    const element = document.querySelector('article.step-card.step-primary');
    return element ? element.getBoundingClientRect().top + window.scrollY : 0;
  });
  await panelInnerFrame.evaluate((y) => window.scrollTo(0, y), Math.max(0, resultTop - 58));
  await composite.waitForTimeout(400);
  log(
    `composite panel scrollY=${await panelInnerFrame.evaluate(() => window.scrollY)} ` +
      `(target top=${Math.round(resultTop)})`,
  );
  await composite.screenshot({ path: path.join(outDir, 'demo-composite.png') });
  log('demo-composite.png');

  await panelFrame.locator('.rag-toggle').click();
  const traceTop = await panelInnerFrame.evaluate(() => {
    const element = document.querySelector('.rag-section');
    return element ? element.getBoundingClientRect().top + window.scrollY : 0;
  });
  await panelInnerFrame.evaluate((y) => window.scrollTo(0, y), Math.max(0, traceTop - 120));
  await composite.waitForTimeout(500);
  await composite.screenshot({ path: path.join(outDir, 'demo-composite-trace.png') });
  log('demo-composite-trace.png');
  await compositeContext.close();

  // ---- 2. 侧边栏细节 ----
  const panelContext = await browser.newContext({
    viewport: { width: 420, height: 940 },
    deviceScaleFactor: 2,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const panelPage = await panelContext.newPage();
  await preparePanel(panelPage);
  await panelPage.screenshot({ path: path.join(outDir, 'panel-empty.png') });
  log('panel-empty.png');

  await panelPage.locator('textarea').fill(customerMessage);
  await generate(panelPage);
  await panelPage.waitForTimeout(300);
  await panelPage.screenshot({ path: path.join(outDir, 'panel-result.png'), fullPage: true });
  log('panel-result.png');

  await panelPage.locator('.step-toggle').first().click();
  await panelPage.locator('.rag-toggle').click();
  await panelPage.waitForTimeout(500);
  await panelPage.screenshot({ path: path.join(outDir, 'panel-trace.png'), fullPage: true });
  log('panel-trace.png');
  await panelContext.close();

  // ---- 3. 交互 GIF（逐帧截图，再用 Pillow 合成）----
  const gifContext = await browser.newContext({
    viewport: { width: 420, height: 940 },
    deviceScaleFactor: 2,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const gifPage = await gifContext.newPage();
  await preparePanel(gifPage);

  let frameIndex = 0;
  const captureFrame = async () => {
    await gifPage.screenshot({
      path: path.join(frameDir, `${String(frameIndex).padStart(4, '0')}.png`),
    });
    frameIndex += 1;
  };
  const holdFrames = async (count, interval = 110) => {
    for (let index = 0; index < count; index += 1) {
      await captureFrame();
      await wait(interval);
    }
  };

  await holdFrames(5);
  await typeCustomerMessage(gifPage, captureFrame);
  await holdFrames(3);
  await generate(gifPage);
  await holdFrames(5);
  await smoothScrollTo(
    gifPage,
    Math.max(0, (await offsetOf(gifPage, 'article.step-primary')) - 62),
    3,
    captureFrame,
  );
  await holdFrames(10);
  await gifPage.locator('.step-toggle').first().click();
  await smoothScrollTo(
    gifPage,
    Math.max(0, (await offsetOf(gifPage, '.step-list-label')) - 84),
    3,
    captureFrame,
  );
  await holdFrames(8);
  await gifPage.locator('.rag-toggle').click();
  await smoothScrollTo(
    gifPage,
    Math.max(0, (await offsetOf(gifPage, '.rag-section')) - 96),
    3,
    captureFrame,
  );
  await holdFrames(10);
  await gifPage.locator('.copy-button').click();
  await holdFrames(6);
  await gifContext.close();
  await browser.close();

  log(`frames: ${frameIndex}`);

  const frames = (await readdir(frameDir)).sort();
  if (frames.length === 0) {
    throw new Error('no frames captured');
  }

  const gifPath = path.join(outDir, 'demo-flow.gif');
  const python = process.env.PYTHON ?? 'python';
  execFileSync(
    python,
    [path.join(import.meta.dirname, 'make_gif.py'), frameDir, gifPath, '700', '95', '160'],
    { stdio: 'inherit' },
  );
  log(`demo-flow.gif (${Math.round(existsSync(gifPath) ? 1 : 0)} file)`);

  await rm(frameDir, { recursive: true, force: true });
}

await main();
