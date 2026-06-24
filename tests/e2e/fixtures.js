// e2e 用フィクスチャ。
// 各テストは localStorage アダプターに固定し、ブラウザ内で完結させる
// （API/DB の共有状態に依存せず、テストごとに独立・高速）。
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('zensales:adapter', 'local'); } catch {}
    });
    await use(page);
  },
});

export { expect };
