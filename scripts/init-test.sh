#!/usr/bin/env bash
# テスト専用セットアップ: PHPUnit (in-memory) + E2E (Playwright) が動く最小構成
# CI や「テストだけ確認したい」ときに使う。npm run build は Playwright が自動実行する。
set -euo pipefail

cd "$(dirname "$0")/.."

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'
step() { echo -e "${CYAN}==> $*${RESET}"; }
ok()   { echo -e "${GREEN}OK: $*${RESET}"; }
die()  { echo -e "${RED}ERROR: $*${RESET}" >&2; exit 1; }

for cmd in php composer node npm; do
  command -v "$cmd" &>/dev/null || die "$cmd が見つかりません"
done
php -r 'version_compare(PHP_VERSION,"8.3.0",">=") or die(1);' || die "PHP 8.3 以上が必要です (現在: $(php -r 'echo PHP_VERSION;'))"

step "PHP 依存関係インストール"
composer install --no-interaction

step ".env ファイル準備"
if [ ! -f .env ]; then
  cp .env.example .env
  ok ".env.example をコピーしました"
else
  ok ".env は既に存在します"
fi

step "アプリケーションキー生成"
php artisan key:generate --ansi

step "SQLite データベース作成 (E2E 用)"
# PHPUnit は :memory: を使うのでファイル不要だが、E2E サーバー起動に必要
touch database/database.sqlite
php artisan migrate --force --ansi

step "Node.js 依存関係インストール"
# Playwright が npm run build を内部で実行するためビルドは不要
npm ci --ignore-scripts

step "Playwright ブラウザインストール (chromium)"
npx playwright install chromium

echo ""
echo -e "${GREEN}テスト環境セットアップ完了!${RESET}"
echo "  PHPUnit テスト: composer test"
echo "  E2E テスト:     npm run test:e2e"
