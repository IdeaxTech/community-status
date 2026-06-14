# 検証レポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-11-calendar.md
**Branch**: feat/calendar
**Verifier**: `verifier` サブエージェント
**Evidence log**: `docs/evidence/verify-2026-06-14-calendar.log` (= `verify-2026-06-14-010849.log`)

## サマリ

**総合判定**: **pass**（静的解析・スペック適合とも合格。`sync-docs` フェーズで対応すべき README ドリフトが 1 件あり）

- 受け入れ基準 8/8 が実装で満たされている
- `./scripts/run-static-verify.sh` — typescript ベリファイア PASS（tsc 合格、eslint/prettier はバイナリ未インストールで SKIP）
- 新規 4 ファイル中 `any` 型使用ゼロ
- README にカレンダー機能の追記なし（プランのベリファイプラン項目）— `/sync-docs` の責務

## スペック適合性

| 受け入れ基準 | ステータス | エビデンス |
|---|---|---|
| AC-1: 月次カレンダーが表示される（7列グリッド） | ✓ 満たされている | `src/components/CalendarView.tsx:112` で `grid grid-cols-7`。`buildCalendarGrid()`（L24-31）が先頭に `firstDay` 個の null を埋め、末尾も 7 の倍数まで null パディング。 |
| AC-2: 毎週木曜セルに「もくもく会 13:00〜20:00」が自動表示 | ✓ 満たされている | `getThursdaysOfMonth()`（L14-22）で `getDay() === 4` を該当月日付に対してスキャン。`MOKUMOKU_LABEL = "もくもく会 13:00〜20:00"`（L11）を該当セルに描画（L129-131）。DB 非永続でクライアント計算（プランの設計決定どおり）。 |
| AC-3: 前月・次月ナビゲーション | ✓ 満たされている | `prevMonth`/`nextMonth`（L57-65）で 1↔12 越えで年を増減。`‹` / `›` ボタンに紐付け（L102/L104）。 |
| AC-4: 日付セルをクリックしてイベントタイトルを入力・追加 | ✓ 満たされている | セル `onClick` で `setAdding(dateStr)`（L126）→ インライン input 表示（L136-154）。Enter キー / 「追加」ボタンで `handleAddEvent` 呼び出し（L142, L147）。 |
| AC-5: 追加したイベントが該当日付セルに表示 | ✓ 満たされている | `handleAddEvent` 成功時に `loadEvents(year, month)` で再フェッチ（L84）。`eventsByDate` を date 単位で集約（L92-95）し、該当セルに `<p>` でレンダリング（L132-134）。 |
| AC-6: `GET /api/calendar?year=2026&month=6` で月間イベント一覧 | ✓ 満たされている | `src/app/api/calendar/route.ts:4-12` で year/month を `Number()` し、1-12 検証後 `getCalendarEvents` を呼ぶ。`src/lib/db.ts:88-98` で `date LIKE 'YYYY-MM-%'`、`ORDER BY date ASC, id ASC`。 |
| AC-7: `POST /api/calendar` でイベント追加（date, title 必須） | ✓ 満たされている | `route.ts:14-30` で JSON ボディ受領、`addCalendarEvent`（`db.ts:100-104`）が prepared statement で INSERT。`created_at` は DEFAULT。 |
| AC-8: title 空・date 不正は 400 | ✓ 満たされている | title trim → 空なら 400（L18-20）。date は `^\d{4}-\d{2}-\d{2}$` 正規表現（L21-23）+ `new Date(date).toISOString().slice(0,10) === date` の往復チェック（L24-27）で `2026-02-30` 等の暦上不正値も弾く。 |

## ドキュメントドリフト

- [ ] **README にカレンダー機能の説明なし** — `README.md` の「機能」「ディレクトリ構成」セクションが `announcements`/`checkins` のみ。`CalendarView.tsx` も `api/calendar/route.ts` もディレクトリツリーに未掲載。プランのベリファイプラン「README にカレンダー機能の説明を追加」が未着手。 → `/sync-docs` フェーズで対応すべき項目。
- [x] CLAUDE.md は変更不要（プロジェクト固有のルール変更なし）
- [x] `.claude/rules/` の更新不要（カレンダー固有のルール追加なし）
- [x] `requirements.md` への追加検討は範囲外（仕様凍結ドキュメント、プランで明示の追記方針なし）

ドキュメントドリフトは **/verify の停止条件ではない**（停止条件は静的解析 fail とスペック適合の fail）。下流の `/sync-docs` で確実に拾うべきギャップとして記録する。

## 静的解析

```
==> Language packs detected: typescript
==> Running typescript verifier
=== TypeScript 検証 ===

--- 型チェック (tsc) ---
  [PASS] 型チェック

--- Lint (eslint) ---
  [SKIP] eslint が見つからない

--- フォーマット (prettier) ---
  [SKIP] prettier が見つからない

=== 結果: PASS=1  FAIL=0  SKIP=2 ===

==> すべてのベリファイアがパスしました。
```

exit code: 0 / Evidence: `docs/evidence/verify-2026-06-14-calendar.log`

### `any` 型監査

`src/` 配下を `\bany\b` で全文検索 — **マッチゼロ**。新規 4 ファイル (`db.ts`, `api/calendar/route.ts`, `CalendarView.tsx`, `MainPage.tsx`) すべてで `any` 不使用を確認。

- `route.ts` POST: `body.json() as { date?: unknown; title?: unknown }` で `unknown` を採用（TypeScript ルール準拠）
- `CalendarView.tsx` の `events` は `CalendarEvent[]`、`eventsByDate` は `Record<string, string[]>` と明示型
- `db.ts` の SQLite 戻り値は配列リテラル型で `as` キャスト

**判定**: **pass**

## 残っているギャップ（未検証項目）

これらは `/verify` の責務外、または決定論的に静的検証できないため `/test` / 手動確認に委ねる：

- **振る舞いテスト一切未実施** — `/verify` ではテスト実行禁止のため。`/test` フェーズで以下を確認する必要：
  - `GET /api/calendar?year=2026&month=6` の正常応答・フォーマット
  - `POST` の正常系（`{ok:true}`）と異常系（空 title、空 date、`2026-13-01`、`2026-02-30`、非文字列）
  - `getCalendarEvents` のテーブル駆動テスト（月境界、うるう年 2 月、12 月→1 月ナビ）
  - `getThursdaysOfMonth` のエッジ（木曜が 1 日始まり、月末 木曜、5 木曜ある月）
- **ブラウザ実機での UI 確認未実施** — 7 列グリッド・モバイル幅レイアウト・木曜セル背景色 `bg-amber-50`・連投時の状態リセット。
- **タイムゾーン挙動** — `new Date()` および `getDay()` はクライアント TZ 依存。JST 以外のクライアントから見ると、グリッド先頭曜日と木曜判定の両方がローカル TZ で一貫するため UI 上の矛盾はないが、「JST の木曜と一致する」確証はクライアント TZ が JST のときのみ。プランのリスクレジスタ「日付計算のタイムゾーンずれ」は依然として実機検証が必要。
- **eslint / prettier 未実行** — ローカルに未インストール。CI で実行されることが期待されるが、現状この静的解析パスは **型チェックのみ** が有効。

## 信頼性を上げる最小限のチェック提案

優先度順：

1. **`api/calendar/route.ts` の Vitest 統合テスト** を `/test` で追加（POST 異常系 400 を 4 ケース＋GET の year/month 400 を 3 ケース）。これが最もリグレッション検出に効く。
2. **eslint / prettier をプロジェクトに導入** — `package.json` に `eslint` / `prettier` を devDependency 追加すれば、既存の `verify-typescript.sh` が自動でフルチェックモードになる（SKIP→PASS）。今回の検証で 2 つの SKIP が残った主因。
3. **`getThursdaysOfMonth` のユニットテスト** — 純関数で副作用なし、コスト最小、エッジケース（2024-02 うるう年、月末木曜の月）で信頼性大。
4. **README の「機能」「ディレクトリ構成」更新** — ドリフト解消は `/sync-docs` 担当だが、`grep -i "calendar" README.md` を CI に組み込めば再発防止可能。

## 結論

**総合判定**: **pass**

- 受け入れ基準 8/8 が実装で満たされており、エビデンスが揃っている
- 静的解析（tsc）はクリーン、`any` 型使用ゼロ
- `./scripts/run-verify.sh` exit code 0

ブロッキングではない残課題：
- README ドリフト（`/sync-docs` の責務）
- eslint/prettier 未インストール（SKIP 解消は別タスク）
- 振る舞いテスト未実施（`/test` で実施）

**次のステップ**: `/test` を実行する（`tester` サブエージェント）。
