# テストレポート — feat/calendar-event-edit-time

**日付**: 2026-06-14  
**ブランチ**: feat/calendar-event-edit-time  
**実行**: ./scripts/run-test.sh → npx vitest run --reporter=verbose  
**判定**: pass

## 結果サマリー

| カテゴリ | 件数 |
|---------|------|
| 通過 | 105 |
| 失敗 | 0 |
| スキップ | 0 |

テストファイル: 6/6 PASS、所要時間 732ms、exit code 0

## プラン vs テストカバレッジ

| 受け入れ基準 | 対応テスト | 結果 |
|------------|-----------|------|
| GET に time フィールドが含まれる | GET > returns events with time field | ✅ |
| POST: time あり/なし | POST > happy path without time / with time | ✅ |
| POST: 不正 time → 400 | 400 on invalid time format / out-of-range | ✅ |
| PUT: タイトル・時間の更新 | PUT > updates title and time | ✅ |
| PUT: time 省略で null | PUT > clears time when omitted | ✅ |
| PUT: 不正 id → 404 | PUT > 404 when id does not exist | ✅ |
| DELETE: 正常削除 | DELETE > deletes an event by id | ✅ |
| DELETE: 不正 id → 404 | DELETE > 404 when id does not exist | ✅ |
| 既存テスト全通過（回帰） | 全 105 テスト | ✅ |

## エビデンス

- 生ログ: docs/evidence/test-2026-06-14-023045.log
