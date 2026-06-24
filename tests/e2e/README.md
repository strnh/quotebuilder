# E2E テスト（Playwright）

ZenSales クローンの End-to-End テスト。`playwright.config.js`（リポジトリ直下）が
`testDir: ./tests/e2e` を指している。

## 前提

```bash
npm install
npx playwright install chromium   # 初回のみ（ブラウザ実体の取得）
```

## 実行

```bash
npm run test:e2e          # ヘッドレス実行（Vite ビルド + php artisan serve を自動起動）
npm run test:e2e:ui       # UI モード
npm run test:e2e:report   # 直近の HTML レポートを表示
```

`webServer` 設定により、テスト実行時に自動で
`npm run build && php artisan serve` が立ち上がる（既にサーバーが起動していれば再利用）。
ポートは `E2E_PORT`（既定 8123）で変更可。

## 構成

| ファイル | 内容 |
|---|---|
| `helpers.js` | ログイン等の共通ヘルパー |
| `auth.spec.js` | 認証・ガード・ログアウト |
| `quotes.spec.js` | 見積書 一覧 / 絞り込み / プレビュー / 新規作成（自動計算） |
| `masters.spec.js` | 取引先・基本情報マスタ / 月末集計 |

## データについて

アプリは `resources/js/data/store.js` の `seedIfEmpty()` で localStorage に
デモデータ（見積書3件・取引先2件・発行者1件）を投入する。各テストは新規
ブラウザコンテキストで動くため localStorage はクリーンに初期化され、テスト間の
データ干渉はない。
