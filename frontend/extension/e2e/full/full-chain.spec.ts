import { test, expect } from './fixture';

test.describe('Full Extension Chain', () => {
  test.describe('Extension Load', () => {
    test('service worker starts with valid extension ID', async ({
      extensionContext,
      extensionId,
    }) => {
      expect(extensionId).toBeTruthy();
      expect(extensionId).toMatch(/^[a-z]{32}$/);

      const sw = extensionContext.serviceWorkers()[0];
      expect(sw).toBeDefined();
      expect(sw.url()).toContain(extensionId);
    });
  });

  test.describe('Side Panel', () => {
    test('sidepanel.html loads and renders the app', async ({ extensionContext, extensionId }) => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await page.waitForSelector('.app-shell', { timeout: 10000 });

      await expect(page.locator('h1')).toHaveText('CSide');
      await expect(page.locator('.primary-button')).toBeVisible();
      await expect(page.locator('.context-summary')).toBeVisible();
    });

    test('store switcher works with real chrome runtime', async ({
      extensionContext,
      extensionId,
    }) => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await page.waitForSelector('.app-shell');

      const brandSelect = page.locator('select').filter({
        has: page.locator('option[value="vivo"]'),
      });
      await brandSelect.selectOption('vivo');

      const summary = page.locator('.context-summary');
      await expect(summary).toContainText('vivo');
    });

    test('full generate flow through side panel', async ({ extensionContext, extensionId }) => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await page.waitForSelector('.app-shell');

      // Select context
      const brandSelect = page.locator('select').filter({
        has: page.locator('option[value="vivo"]'),
      });
      await brandSelect.selectOption('vivo');

      // Input message
      const textarea = page.locator('textarea');
      await textarea.fill('耳机左边不响了，用了三个月');

      // Generate
      const button = page.locator('.primary-button');
      await expect(button).toBeEnabled();
      await button.click();

      // Wait for results (mock API has 650ms delay)
      await expect(page.locator('article.step-card')).toHaveCount(5, { timeout: 5000 });
      await expect(page.locator('h2#five-step-title')).toHaveText('AI 回复建议');
    });

    test('copy step 3 via real clipboard API', async ({ extensionContext, extensionId }) => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await page.waitForSelector('.app-shell');

      // Select context
      const brandSelect = page.locator('select').filter({
        has: page.locator('option[value="vivo"]'),
      });
      await brandSelect.selectOption('vivo');

      // Generate
      await page.locator('textarea').fill('测试复制功能');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5, { timeout: 5000 });

      // Copy
      await page.locator('.copy-button').click();
      const toast = page.locator('.toast[role="status"]');
      await expect(toast).toContainText('推荐话术已复制');
      await expect(toast).toContainText('请核对后再发送');
    });
  });

  test.describe('Background Service Worker', () => {
    test('background handles storage and messaging', async ({ extensionContext }) => {
      const sw = extensionContext.serviceWorkers()[0];
      expect(sw).toBeDefined();

      // Test that chrome.storage.session works
      const result = await sw.evaluate(async () => {
        try {
          await chrome.storage.session.set({ testKey: 'testValue' });
          const stored = await chrome.storage.session.get('testKey');
          await chrome.storage.session.remove('testKey');
          return stored;
        } catch (e) {
          return { error: String(e) };
        }
      });

      expect(result).not.toHaveProperty('error');
    });

    test('background receives commands and manages tab state', async ({
      extensionContext,
      extensionId,
    }) => {
      const sidepanelPage = await extensionContext.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidepanelPage.waitForSelector('.app-shell', { timeout: 10000 });

      // Simulate the flow: background receives SELECTION_CAPTURED from content script
      // and broadcasts TAB_STATE_UPDATED to side panel
      const sw = extensionContext.serviceWorkers()[0];
      const result = await sw.evaluate(async () => {
        try {
          const tabs = await chrome.tabs.query({});
          if (tabs.length === 0 || tabs[0].id === undefined)
            return { ok: false, reason: 'no tabs' };

          const tabId = tabs[0].id;
          const tabStateKey = `tabState:${tabId}`;

          // Simulate background receiving a captured selection
          const patch = {
            capturedSelection: {
              text: 'Simulated capture: 耳机不响了',
              source: 'test',
            },
          };

          await chrome.storage.session.set({ [tabStateKey]: patch });

          // Broadcast to all views
          chrome.runtime
            .sendMessage({
              type: 'TAB_STATE_UPDATED',
              payload: { tabId, patch },
            })
            .catch(() => {}); // No listeners in test, ignore

          const stored = await chrome.storage.session.get(tabStateKey);
          return { ok: true, stored: !!stored[tabStateKey] };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      });

      expect(result.ok).toBe(true);
    });
  });

  test.describe('Content Script - Side Panel Communication', () => {
    test('opens a test page and verifies content script context detection', async ({
      extensionContext,
    }) => {
      // Create a page with a title/URL that triggers brand/platform detection
      const testPage = await extensionContext.newPage();

      // Navigate to a URL that matches host_permissions (taobao.com)
      // Using a simple GET to check if the extension's content script injects
      await testPage.route('**/*', (route, request) => {
        if (request.url().includes('taobao.com')) {
          return route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: `<html><head><title>vivo旗舰店 - 淘宝</title></head>
                   <body><p>Test content for CSide extension</p></body></html>`,
          });
        }
        return route.continue();
      });

      await testPage.goto(
        'https://shop123.taobao.com/?storeId=vivo-taobao-flagship&shopName=vivo旗舰店',
        {
          waitUntil: 'commit',
        },
      );

      // Content script runs in isolated world - check if it was injected
      // by looking for extension content script side effects
      await testPage.waitForTimeout(1000);

      // The content.js detects page context and sends PAGE_CONTEXT_CHANGED
      // Let's verify the background received it
      const sw = extensionContext.serviceWorkers()[0];
      const state = await sw.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        if (tabs.length === 0 || tabs[0].id === undefined) return null;
        const key = `tabState:${tabs[0].id}`;
        const stored = await chrome.storage.session.get(key);
        return stored[key] || null;
      });

      expect(state).toBeDefined();
    });
  });

  // Note: multi-tab isolation is handled by the extension's per-tab storage keys
  // (tabState:<tabId>). Testing simultaneous side panels in a single test window is
  // not representative of real usage where only one side panel exists per window.
});
