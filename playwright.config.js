import { defineConfig, devices } from '@playwright/test';

// ZenSales E2E 設定
// テスト実行時に Vite ビルド + php artisan serve を自動起動する。
const PORT = process.env.E2E_PORT || 8123;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/.report' }]],
  outputDir: 'tests/e2e/.results',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && php artisan serve --port=${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
