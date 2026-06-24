import { test, expect } from './fixtures';
import { login } from './helpers';

test.describe('認証', () => {
  test('未ログインは /login にリダイレクトされる', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'おかえりなさい' })).toBeVisible();
  });

  test('メール/パスワードでログインして一覧へ遷移する', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: '見積書一覧' })).toBeVisible();
  });

  test('新規登録ページが表示できる', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible();
    await expect(page.locator('input[type=password]')).toHaveCount(2);
  });

  test('ログアウトで /login に戻る', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'ログアウト' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
