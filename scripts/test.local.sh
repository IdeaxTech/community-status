#!/usr/bin/env sh
# プロジェクト固有のテストランナー: vitest を一度だけ実行する。
set -eu

cd "$(dirname "$0")/.."

echo "==> npx vitest run"
exec npx vitest run --reporter=verbose
