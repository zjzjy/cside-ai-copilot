import { defineConfig } from '@playwright/test';

// 组件测试专用的独立端口：管理后台开发服务器默认也占用 5173，
// 固定一个不冲突的端口并开启 strictPort，避免静默复用到别的应用上。
const COMPONENT_PORT = Number(process.env.CSIDE_TEST_PORT ?? 5199);
const COMPONENT_BASE_URL = `http://127.0.0.1:${COMPONENT_PORT}`;

export default defineConfig({
  reporter: [['html', { open: 'never' }], ['line']],
  timeout: 30000,
  retries: 0,
  workers: 1,

  projects: [
    {
      name: 'component',
      testDir: './e2e/component',
      use: {
        baseURL: COMPONENT_BASE_URL,
        viewport: { width: 400, height: 700 },
        channel: 'chrome',
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      webServer: {
        command: `npx vite --port ${COMPONENT_PORT} --strictPort --host 127.0.0.1`,
        url: COMPONENT_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
    },
    {
      name: 'full-chain',
      testDir: './e2e/full',
      use: {
        viewport: { width: 400, height: 700 },
      },
    },
  ],
});
