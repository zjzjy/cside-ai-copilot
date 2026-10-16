import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

const DIST_PATH = path.resolve('dist');

export interface ExtensionFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
}

export const test = base.extend<ExtensionFixtures>({
  extensionContext: [
    async (_, use) => {
      const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [`--disable-extensions-except=${DIST_PATH}`, `--load-extension=${DIST_PATH}`],
      });
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ extensionContext }, use) => {
      let extensionId: string | undefined;

      // Try existing service workers first
      const sw = extensionContext.serviceWorkers()[0];
      if (sw) {
        extensionId = sw.url().split('/')[2];
      }

      if (!extensionId) {
        // Wait for service worker to start
        const worker = await extensionContext.waitForEvent('serviceworker', { timeout: 30000 });
        extensionId = worker.url().split('/')[2];
      }

      if (!extensionId) {
        throw new Error('Failed to extract extension ID from service worker');
      }

      await use(extensionId);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
