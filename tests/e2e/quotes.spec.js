import { test, expect } from './fixtures';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('見積書', () => {
  test('一覧にシードされた見積書が表示される', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('tbody').getByText('株式会社アルファ商事').first()).toBeVisible();
  });

  test('ステータスタブで絞り込める', async ({ page }) => {
    await page.getByRole('button', { name: /^受注/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('検索で絞り込める', async ({ page }) => {
    await page.getByPlaceholder('顧客名・見積番号で検索...').fill('ベータ');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody').getByText('ベータ工業株式会社')).toBeVisible();
  });

  test('年月で絞り込める', async ({ page }) => {
    const year = new Date().getFullYear();
    // シードは全件 6 月作成のため、5 月の見積を 1 件追加して月で件数が変わることを検証する
    await page.evaluate((y) => {
      const rows = JSON.parse(localStorage.getItem('quotes:quotes'));
      rows.push({ ...rows[0], id: 'id_e2e_may', quote_number: `Q-${y}05-001`, created_date: `${y}-05-10` });
      localStorage.setItem('quotes:quotes', JSON.stringify(rows));
    }, year);
    await page.reload();
    await expect(page.locator('tbody tr')).toHaveCount(4);

    const monthSelect = page.getByLabel('年月で絞り込み');
    await monthSelect.selectOption(`${year}-06`);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await monthSelect.selectOption(`${year}-05`);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await monthSelect.selectOption('');
    await expect(page.locator('tbody tr')).toHaveCount(4);
  });

  test('取引先で絞り込める', async ({ page }) => {
    const customerSelect = page.getByLabel('取引先で絞り込み');
    await customerSelect.selectOption({ label: 'ベータ工業株式会社' });
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('事務用品定期納入')).toBeVisible();
    await customerSelect.selectOption('');
    await expect(page.locator('tbody tr')).toHaveCount(3);
  });

  test('タブ・検索・年月・取引先を併用して絞り込める（AND条件）', async ({ page }) => {
    const year = new Date().getFullYear();
    await page.getByLabel('年月で絞り込み').selectOption(`${year}-06`);
    await page.getByLabel('取引先で絞り込み').selectOption({ label: '株式会社アルファ商事' });
    await expect(page.locator('tbody tr')).toHaveCount(2);
    // さらにステータスタブで絞る
    await page.getByRole('button', { name: /^受注/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Webシステム開発一式')).toBeVisible();
    // さらに検索でヒットしない語を入れると 0 件（フィルタ起因の空状態メッセージ）
    await page.getByPlaceholder('顧客名・見積番号で検索...').fill('存在しない語');
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await expect(page.getByText('条件に一致する見積書がありません')).toBeVisible();
  });

  test('行クリックでプレビュー（見積書レイアウト）が開く', async ({ page }) => {
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
    await expect(page.getByText('御　見　積　書')).toBeVisible();
    await expect(page.getByText('御中')).toBeVisible();
    await expect(page.getByText('合計金額：')).toBeVisible();
  });

  test('新規作成: 取引先・品目を入力して保存できる（合計が自動計算される）', async ({ page }) => {
    await page.goto('/quotes/new');
    // 取引先を選択（2番目のSelect = 取引先）
    const selects = page.locator('select');
    await selects.nth(1).selectOption({ label: '株式会社アルファ商事' });

    // 1行目の品目入力（品名・数量・納入単価）
    const row = page.locator('.grid.grid-cols-12').nth(1); // 0=ヘッダ, 1=最初の行
    await row.locator('input').nth(0).fill('テスト商品');     // 品名
    await row.locator('input[type=number]').nth(0).fill('3'); // 数量
    await row.locator('input[type=number]').nth(2).fill('1000'); // 納入単価

    // サマリーに合計 ¥3,300（税10%）が出る
    await expect(page.getByText('¥3,300')).toBeVisible();

    await page.getByRole('button', { name: '保存' }).click();
    // 保存後はプレビューへ
    await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
    await expect(page.getByText('御　見　積　書')).toBeVisible();
  });

  test('品目を追加・削除できる', async ({ page }) => {
    await page.goto('/quotes/new');
    const rowsBefore = await page.locator('.grid.grid-cols-12').count();
    await page.getByRole('button', { name: '品目を追加' }).click();
    const rowsAfter = await page.locator('.grid.grid-cols-12').count();
    expect(rowsAfter).toBe(rowsBefore + 1);
  });

  test('既存見積書を編集してステータスを変更できる', async ({ page }) => {
    // 一覧から先頭（下書き）を開いて編集
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: '編集' }).click();
    await expect(page).toHaveURL(/\/quotes\/[^/]+\/edit$/);

    // フォームに既存値がハイドレートされている（件名が空でない）
    const subject = page.getByPlaceholder('件名を入力');
    await expect(subject).not.toHaveValue('');

    // 件名を変更し、ステータスを受注へ
    await subject.fill('編集後の件名テスト');
    await page.locator('select').filter({ hasText: '下書き' }).selectOption('accepted');
    await page.getByRole('button', { name: '保存' }).click();

    // プレビューに変更が反映される
    await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
    await expect(page.getByText('編集後の件名テスト')).toBeVisible();

    // 一覧に戻ると受注ステータスになっている
    await page.getByRole('button', { name: '一覧に戻る' }).click();
    await expect(page.getByRole('button', { name: /^受注/ })).toContainText('2');
  });

  test('見積書を削除できる（確認モーダル経由）', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: '削除' }).click();
    // 確認モーダル
    await expect(page.getByText('この操作は取り消せません。')).toBeVisible();
    await page.getByRole('button', { name: '削除', exact: true }).last().click();
    // 一覧に戻り 1 件減る
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});
