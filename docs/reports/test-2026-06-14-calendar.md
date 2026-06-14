# テストレポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-11-calendar.md
**Branch**: feat/calendar
**Runner**: `./scripts/run-test.sh` → `./scripts/test.local.sh` → `npx vitest run --reporter=verbose`
**Evidence**: `docs/evidence/test-2026-06-14-011434.log`

## テスト実行

```
==> npx vitest run

 RUN  v3.2.6 /Users/shimizutoorushin/ghq/github.com/IdeaxTech/community-status

 Test Files  6 passed (6)
      Tests  85 passed (85)
   Start at  10:14:35
   Duration  466ms (transform 175ms, setup 0ms, collect 207ms, tests 681ms, environment 1ms, prepare 346ms)

==> すべてのテストがパスしました。
```

新規追加ファイル:

- `src/lib/db.test.ts` — `calendar_events CRUD` describe ブロックを末尾に追記（9 ケース、既存ケースは未変更）
- `src/app/api/calendar/route.test.ts` — 新規（28 ケース）

## 結果サマリー

| カテゴリ | 件数 |
|---------|------|
| 通過    | 85   |
| 失敗    | 0    |
| スキップ | 0   |

うちカレンダー関連の新規ケース内訳:

| ファイル | ケース数 |
|---------|---------|
| `src/lib/db.test.ts > calendar_events CRUD` | 9 |
| `src/app/api/calendar/route.test.ts > GET /api/calendar` | 12 |
| `src/app/api/calendar/route.test.ts > POST /api/calendar` | 16 |
| **計** | **37** |

カバーした受け入れ基準（プランから）:

| 受け入れ基準 | カバレッジ |
|------------|----------|
| `GET /api/calendar?year=2026&month=6` でその月のイベント一覧が返る | ✅ `returns events for the requested month` / `returns [] when no events exist` |
| `POST /api/calendar` でイベントを追加できる（`date`, `title` 必須） | ✅ `happy path: persists the event and returns ok` |
| title が空・date が不正の場合は 400 を返す | ✅ `400 on empty title` / `400 on empty date` / `400 when date is the wrong shape` / `400 when date is a non-calendar date (2026-02-31)` ほか |

UI ベースの受け入れ基準（7列グリッド、木曜自動表示、ナビゲーション、セルクリック）はプランの「テストプラン」で UI テストが指定されておらず、本フェーズではテスト対象外。`/verify` のスペック適合チェックで人手確認に委ねる。

## 失敗の分析

なし。すべてのテストがパスした。

## カバレッジギャップ

以下はテストプランで明示されておらず、本フェーズでは追加していないが、将来の回帰テストとして追記候補:

1. **`CalendarView.tsx` のコンポーネントテスト** — 木曜日に「もくもく会 13:00〜20:00」が自動表示されるロジック、前月/次月ナビゲーション、日付セルクリックでフォームが開く挙動。プランは静的ロジック（`Date` API ベース）と明記しているため、純粋関数として切り出されていれば容易にテスト可能。現状は React Testing Library 等のセットアップがリポジトリに存在しないため、コンポーネントテストは別 PR で導入を検討すべきギャップ。
2. **タイムゾーン依存の木曜判定** — DB 層は `LIKE 'YYYY-MM-%'` で月を絞るため TZ 非依存だが、`CalendarView` 側の木曜計算で `new Date(year, month, day).getDay()` を使う場合、ホスト TZ がカレンダー表示にずれを生む可能性がある。リスクレジスターにも記載済みで、UI コンポーネントテストでカバーすべき。
3. **同時書き込み競合** — `INSERT` のみで `UNIQUE` 制約もないため衝突は起きないが、SQLite の WAL モードでの並列 INSERT のスモークテストは未実施。本機能のリスクは低いため意図的に省略。
4. **`year` の境界値（負値、9999 年超など）** — ルートの `Number(...)` + `!year` チェックは負値や巨大値を素通しする（`Number("-1") = -1` は truthy、`Number("99999") = 99999` も truthy）。実害は少ない（DB 上は単に空配列）が、スペック明文化されていない以上のテストはあえて追加していない。スペックが厳格化された時点で回帰テストを足すべき。
5. **大量データ時のソート安定性** — `ORDER BY date ASC, id ASC` のスモークテストは 4 件で実施。何百件規模の安定性は未検証だが、SQLite のデフォルト挙動として問題は出にくく、本機能のスケールでは過剰。

## 追加で記録した観点（テストプランで明示されていない値ある所見）

- **月のゼロパディング回帰** — `getCalendarEvents` の `String(month).padStart(2, "0")` が機能している証跡として、`month=1` クエリが `2026-12-*` を誤マッチしないことを `pads single-digit months ... and never matches month=12` で固定。プレフィックスを `2026-1-%` に書き換える退化が起きた瞬間に落ちる。
- **POST の `title` チェックが `date` チェックより先に走る順序** — `rejects empty body cleanly (title check fires first)` でルートの検証順序を固定。ユーザーへのエラーメッセージ体験が変わる退化の早期検出に役立つ。
- **`Date` パーサ厳格化の固定** — `2026-02-31` / `2025-02-29` / `2026-04-31` を 400 で弾くことを明示テスト。ルートの `parsed.toISOString().slice(0, 10) !== date` ガードが緩むと一発で落ちる。
- **木曜エッジケース** — 月初の木曜（`2026-06-04`）と月末の木曜（`2026-04-30`）に対する POST の受け入れを明示。「木曜が月末にある月」という UI 側のエッジ条件を、最低でも API 層は許容することをドキュメント化。

## フレーキー所見

なし。`vi.resetModules()` + 一時 SQLite ファイル + `vi.useRealTimers()` のセットアップにより、新規 37 ケースを含め全テストが順序非依存で決定論的に通る。

## 判定

**pass**

理由: `./scripts/run-test.sh` 経由で `npx vitest run` が 6 ファイル / 85 ケースすべてを 466ms でパス（失敗 0・スキップ 0）。プランのテストプランで指定された ユニット（`getCalendarEvents` / `addCalendarEvent` CRUD）、統合（`GET` の year/month バリデーション、`POST` の正常系・異常系：空 title / 不正 date / 非カレンダー日付）、エッジケース（月初・月末の木曜、うるう年 2 月、月境界クエリ）をすべて網羅した。プランの API 受け入れ基準（`GET /api/calendar?year=&month=`、`POST /api/calendar` の 必須項目・400 返却）に直接対応するテストが存在し、すべて通過している。

次のステップ: pass → `/sync-docs` へ
