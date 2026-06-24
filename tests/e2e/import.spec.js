import { test, expect } from './fixtures';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('見積書取込', () => {
  test('ナビから取込画面を開ける', async ({ page }) => {
    await page.getByRole('link', { name: '見積書取込' }).click();
    await expect(page).toHaveURL(/\/import$/);
    await expect(page.getByRole('heading', { name: '見積書取込' })).toBeVisible();
  });

  test('xlsx を取り込むと結果に下書き警告が表示され一覧が増える', async ({ page }) => {
    await page.goto('/import');

    await page.locator('[data-testid=import-input]').setInputFiles({
      name: 'H-CMK2026062401.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('mock'),
    });
    await expect(page.getByText('H-CMK2026062401.xlsx')).toBeVisible();

    await page.getByRole('button', { name: '取込実行' }).click();

    // 取込結果に成功カード（未突合バッジ・モック警告）が出る
    await expect(page.getByRole('heading', { name: '取込結果' })).toBeVisible();
    await expect(page.getByText('取引先未突合')).toBeVisible();
    await expect(page.getByText(/モック取込/)).toBeVisible();

    // 一覧に戻ると下書きが 1 件増えている（シード3件 → 4件）
    await page.getByRole('link', { name: '見積書一覧' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);
  });

  test('未対応拡張子はエラーとして表示される', async ({ page }) => {
    await page.goto('/import');

    await page.locator('[data-testid=import-input]').setInputFiles({
      name: 'H-CMK2026062401.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock'),
    });
    await page.getByRole('button', { name: '取込実行' }).click();

    await expect(page.getByText(/未対応/)).toBeVisible();
  });
});
