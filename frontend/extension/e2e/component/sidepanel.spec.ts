import { test, expect } from '@playwright/test';

test.describe('Side Panel UI', () => {
  test.beforeEach(async ({ page }) => {
    // 本机可能正在跑真实后端（:8181），这里直接掐断，保证组件测试永远走 Mock API。
    await page.route('**/localhost:8181/**', (route) => route.abort());
    await page.goto('/sidepanel.html');
    await page.waitForSelector('.app-shell');
  });

  test.describe('Store Switcher', () => {
    test('changing brand updates platform and store selects', async ({ page }) => {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('huawei');

      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      const platformValue = await platformSelect.inputValue();
      expect(['taobao', 'jd']).toContain(platformValue);

      const summary = page.locator('.context-summary');
      await expect(summary).toContainText('华为');
    });

    test('changing platform filters available stores', async ({ page }) => {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');

      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      await platformSelect.selectOption('jd');

      const storeSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo-jd-flagship"]') });
      await expect(storeSelect).toHaveValue('vivo-jd-flagship');
    });
  });

  test.describe('Message Input', () => {
    test('character count updates as user types', async ({ page }) => {
      const textarea = page.locator('textarea');
      await textarea.fill('你好');

      const counter = page.locator('.input-meta span').last();
      await expect(counter).toContainText('2/500');
    });

    test('shows warning when over 500 characters', async ({ page }) => {
      const textarea = page.locator('textarea');
      await textarea.fill('a'.repeat(501));

      const errorText = page.locator('.validation-error');
      await expect(errorText.first()).toContainText('已超过 500 字限制');

      const button = page.locator('.primary-button');
      await expect(button).toBeDisabled();
    });

    test('button disabled with empty message even with complete context', async ({ page }) => {
      // Select valid context first to isolate the empty-message condition
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');

      // Button should still be disabled because message is empty
      const button = page.locator('.primary-button');
      await expect(button).toBeDisabled();
    });
  });

  test.describe('Generate Flow', () => {
    async function selectContext(page: import('@playwright/test').Page) {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');

      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      await platformSelect.selectOption('taobao');
    }

    test('full generate flow from input to five-step results', async ({ page }) => {
      await selectContext(page);

      const textarea = page.locator('textarea');
      await textarea.fill('耳机左边不响了，用了三个月');

      const button = page.locator('.primary-button');
      await expect(button).toBeEnabled();
      await button.click();

      await expect(page.locator('section[aria-busy="true"]')).toBeVisible();

      await expect(page.locator('article.step-card')).toHaveCount(5);

      await expect(page.locator('h2#five-step-title')).toHaveText('AI 回复建议');

      // 推荐话术常驻展开，且排在第一步
      const primaryCard = page.locator('article.step-card.step-primary');
      await expect(primaryCard).toBeVisible();
      await expect(primaryCard.locator('.step-content')).not.toBeEmpty();
      await expect(page.locator('.result-section article').first()).toHaveClass(/step-primary/);
    });

    test('supporting steps are collapsed by default and expand on click', async ({ page }) => {
      await selectContext(page);
      await page.locator('textarea').fill('耳机左边不响了，用了三个月');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5);

      const supportingToggles = page.locator('.step-toggle');
      await expect(supportingToggles).toHaveCount(4);

      for (const index of [0, 1, 2, 3]) {
        await expect(supportingToggles.nth(index)).toHaveAttribute('aria-expanded', 'false');
      }
      await expect(page.locator('.step-collapsible .step-content')).toHaveCount(0);

      await supportingToggles.first().click();
      await expect(supportingToggles.first()).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.step-collapsible .step-content')).toHaveCount(1);
    });

    test('溯源 panel stays collapsed until expanded', async ({ page }) => {
      await selectContext(page);
      await page.locator('textarea').fill('耳机左边不响了，用了三个月');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5);

      const ragToggle = page.locator('.rag-toggle');
      await expect(ragToggle).toContainText('溯源');
      await expect(ragToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.rag-card')).toHaveCount(0);

      await ragToggle.click();
      await expect(ragToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.rag-card')).toHaveCount(3);
    });

    test('loading state shows skeleton cards', async ({ page }) => {
      await selectContext(page);

      const textarea = page.locator('textarea');
      await textarea.fill('测试消息');

      await page.locator('.primary-button').click();

      await expect(page.locator('.skeleton-card')).toHaveCount(5);
      await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
    });

    test('error state with retry', async ({ page }) => {
      await selectContext(page);

      const textarea = page.locator('textarea');
      await textarea.fill('#mock-error');

      await page.locator('.primary-button').click();

      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('.error-state')).toContainText('这次没有生成成功');
      await expect(page.locator('.error-state')).toContainText('2001');

      const retryButton = page.locator('.error-state button');
      await expect(retryButton).toHaveText('重新生成');
    });

    test('requires complete context before generating', async ({ page }) => {
      const textarea = page.locator('textarea');
      await textarea.fill('测试消息');

      const button = page.locator('.primary-button');
      await expect(button).toBeDisabled();
    });
  });

  test.describe('Copy Functionality', () => {
    async function generateResult(page: import('@playwright/test').Page) {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');
      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      await platformSelect.selectOption('taobao');
      await page.locator('textarea').fill('耳机不响了');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5);
    }

    test('copy step 3 shows toast notification', async ({ page }) => {
      await generateResult(page);

      await page.locator('.copy-button').click();

      const toast = page.locator('.toast[role="status"]');
      await expect(toast).toContainText('推荐话术已复制');
    });

    test('copied content matches step 3 text', async ({ page }) => {
      await generateResult(page);

      const step3Text = await page.locator('.step-card.step-3 .step-content').textContent();

      await page.locator('.copy-button').click();

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(step3Text);
    });
  });

  test.describe('Favorite Functionality', () => {
    async function generateResult(page: import('@playwright/test').Page) {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');
      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      await platformSelect.selectOption('taobao');
      await page.locator('textarea').fill('耳机不响了');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5);
    }

    test('favorite button toggles state and shows toast', async ({ page }) => {
      await generateResult(page);

      const favButton = page.locator('.favorite-button').first();
      await expect(favButton).toContainText('收藏');
      await favButton.click();

      await expect(favButton).toContainText('已收藏');

      const toast = page.locator('.toast[role="status"]');
      await expect(toast).toContainText('已收藏');
    });

    test('favorite button is disabled after clicked', async ({ page }) => {
      await generateResult(page);

      const favButton = page.locator('.favorite-button').first();
      await favButton.click();

      await expect(favButton).toBeDisabled();
      await expect(favButton).toContainText('已收藏');
    });
  });

  test.describe('Toast Notification', () => {
    test('toast disappears after a few seconds', async ({ page }) => {
      const brandSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="vivo"]') });
      await brandSelect.selectOption('vivo');
      const platformSelect = page
        .locator('select')
        .filter({ has: page.locator('option[value="taobao"]') });
      await platformSelect.selectOption('taobao');
      await page.locator('textarea').fill('测试');
      await page.locator('.primary-button').click();
      await expect(page.locator('article.step-card')).toHaveCount(5);

      await page.locator('.copy-button').click();

      const toast = page.locator('.toast[role="status"]');
      await expect(toast).toBeVisible();
      await expect(toast).not.toBeVisible({ timeout: 5000 });
    });
  });
});
