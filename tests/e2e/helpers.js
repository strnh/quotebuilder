// 共通ヘルパー: ログイン（モック認証・メール/パスワードのみ）。
// 各テストは新規ブラウザコンテキストで実行されるため localStorage はクリーンで、
// アプリ側の seedIfEmpty がデモデータ（見積書3件・取引先2件・発行者1件）を投入する。
export async function login(page, email = 'demo@example.com', password = 'password') {
  await page.goto('/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/');
}
