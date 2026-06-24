import { test, expect } from './fixtures';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('マスタ管理', () => {
  test('取引先マスタ: 新規登録できる', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: '取引先マスタ' })).toBeVisible();
    await page.getByRole('button', { name: '新規追加' }).click();
    await page.getByPlaceholder('株式会社〇〇').fill('テスト取引先株式会社');
    await page.getByPlaceholder('CMK').fill('TESTCO');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('テスト取引先株式会社')).toBeVisible();
  });

  test('取引先マスタ: 検索で絞り込める', async ({ page }) => {
    await page.goto('/customers');
    await page.getByPlaceholder('取引先名で検索').fill('ベータ');
    await expect(page.getByText('ベータ工業株式会社')).toBeVisible();
    await expect(page.getByText('株式会社アルファ商事')).toHaveCount(0);
  });

  test('基本情報マスタ: 発行者が表示されデフォルトバッジが付く', async ({ page }) => {
    await page.goto('/sender-profiles');
    await expect(page.getByRole('heading', { name: '基本情報マスタ' })).toBeVisible();
    await expect(page.getByText('株式会社ゼンセールス')).toBeVisible();
    await expect(page.getByText('デフォルト', { exact: true })).toBeVisible();
  });

  test('基本情報マスタ: 新規追加して別の発行者をデフォルトに切り替えられる', async ({ page }) => {
    await page.goto('/sender-profiles');
    await page.getByRole('button', { name: '新規追加' }).click();
    await page.getByPlaceholder('株式会社〇〇').fill('第二発行者株式会社');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('第二発行者株式会社')).toBeVisible();

    // 追加直後はデフォルトではない → 「デフォルトに設定」で切り替え
    await page.getByRole('button', { name: 'デフォルトに設定' }).click();
    // バッジが1つだけ（切り替わった）
    await expect(page.getByText('デフォルト', { exact: true })).toHaveCount(1);
  });
});

test.describe('月末集計', () => {
  test('KPIと月別明細が表示される', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByRole('heading', { name: '月末集計' })).toBeVisible();
    await expect(page.getByText('受注率')).toBeVisible();
    await expect(page.getByText('月別推移')).toBeVisible();
    await expect(page.getByText('月別明細')).toBeVisible();
  });
});
