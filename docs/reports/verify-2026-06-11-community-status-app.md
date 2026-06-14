# 検証レポート

**Date**: 2026-06-11
**Plan**: docs/plans/active/2026-06-11-community-status-app.md
**Branch**: feat/community-status-app
**Evidence log**: docs/evidence/verify-2026-06-11-053933.log

## サマリー

プラン記載の 10 項目の受け入れ基準はすべて静的読み取りで満たされている。`./scripts/run-verify.sh` は exit 0（TypeScript 型チェック PASS、ESLint/Prettier は未インストールで SKIP）。`.env.local.example` は実装で参照されている 2 つの環境変数（`DISCORD_WEBHOOK_URL`, `DB_PATH`）と一致しており、ドキュメントドリフトはない。`src/` 配下に `any` は 0 件で、API レスポンスは構造化された型として返されている。`/test` で振る舞いを最終確認する前提のもと、判定は **pass**。

## スペック適合性

| # | 受け入れ基準 | ステータス | エビデンス |
|---|--------------|-----------|-----------|
| 1 | トップページにもくもく会の固定開催情報が表示される | ✓ 満たされている | `src/components/MainPage.tsx:18-23` が `<header>` 内に「📅 定期開催 / 毎週土曜日 13:00〜18:00 / 会場: コミュニティスペース…」を静的に描画。`page.tsx` は `<MainPage />` をマウントする |
| 2 | 会場状況お知らせ一覧が新しい順で表示される | ✓ 満たされている | `src/lib/db.ts:46` の `getAnnouncements` が `ORDER BY id DESC` で取得。`src/app/api/announcements/route.ts:5-7` の GET がそのまま返却。`AnnouncementForm.tsx:16-20, 58-66` で配列順にリスト描画（並べ替えなし）→ 結果として降順 |
| 3 | 現在の参加者数と Discord 名一覧が表示される | ✓ 満たされている | `src/app/api/status/route.ts:5-10` が `{ count, names }` を返し、`StatusBoard.tsx:36-49` が「<count>人」と `<li>` 一覧で描画。30 秒ごとに polling（line 29） |
| 4 | 認証なしで会場状況を一言投稿できる | ✓ 満たされている | `src/app/api/announcements/route.ts:9-20` の POST は認証ヘッダ・セッションを一切要求せず、`content` のみで `addAnnouncement` を呼ぶ。`AnnouncementForm.tsx:26-37` の UI も認証 UI なし |
| 5 | Discord 名を入力してチェックインできる | ✓ 満たされている | `src/app/api/checkin/route.ts:4-12` の POST が `discord_name` を受け、`addCheckin`（`src/lib/db.ts:66-73`、`INSERT OR REPLACE` で upsert）を呼ぶ。`CheckinForm.tsx:10-21` がフォーム送信 |
| 6 | チェックアウトで自分の名前を削除できる | ✓ 満たされている | `src/app/api/checkin/route.ts:14-22` の DELETE が `removeCheckin` を呼び、`src/lib/db.ts:75-79` が `DELETE FROM checkins WHERE discord_name = ?` を実行。`CheckinForm.tsx:23-34` がボタン提供 |
| 7 | 日付が変わると（JST 0:00）チェックイン情報が自動リセットされる | ✓ 満たされている | レイジー方式：`src/lib/db.ts:56-64` の `getCheckins` が呼ばれるたびに `DELETE FROM checkins WHERE date != ?`（今日の JST 日付）を実行。`todayJst()`（lines 32-42）は `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" })` を使用しホスト TZ から独立 — `/self-review` 所見 #1 への修正が反映済み |
| 8 | 会場状況投稿時に Discord Webhook 通知が送信される（投稿内容 + 現在の参加人数） | ✓ 満たされている | `src/app/api/announcements/route.ts:15-18` で `addAnnouncement` 後に `getCheckins().length` を `sendAnnouncement(content, count)` に渡す。`src/lib/discord.ts:1-17` の payload は投稿内容と「現在の参加人数: **<n>人**」を含む |
| 9 | 通常開催時は Discord に通知しない | ✓ 満たされている | Discord 通知は `POST /api/announcements`（`sendAnnouncement` 経由）でのみ発火。`addCheckin`/`removeCheckin` および「定期開催」表示には通知パスがない（コード中で `sendAnnouncement` を呼ぶ場所はこの 1 箇所のみ） |
| 10 | `DISCORD_WEBHOOK_URL` が未設定の場合は通知をスキップしてエラーにならない | ✓ 満たされている | `src/lib/discord.ts:5-6`: `if (!webhookUrl) return;` で early return。さらに `src/app/api/announcements/route.ts:18` 側で `void sendAnnouncement(...).catch(() => undefined)` で fire-and-forget 化されており、Webhook 障害でも API は 200 を返す |

## ドキュメントドリフト

- [x] `.env.local.example` が実装と一致している
  - 実装が参照する環境変数は 2 つ：`DISCORD_WEBHOOK_URL`（`src/lib/discord.ts:5`）と `DB_PATH`（`src/lib/db.ts:4`）。`.env.local.example` は両方を記載済み（コメント付き）。
- [x] CLAUDE.md は変更不要（プロジェクトレベルの参照ガイドであり、機能追加では更新対象外）
- [x] 関連する `.claude/rules/` 更新不要（TypeScript/architecture/testing/documentation の既存ルールに従っており、新ルールは不要）
- [x] `.gitignore` が `*.db`, `*.db-shm`, `*.db-wal`, `.env*.local` を除外（実装が生成するアーティファクトと一致）

備考：README.md がリポジトリに存在しない（top-level の `requirements.md` のみ）。プランの非ゴールに README 整備は含まれず、`/sync-docs` フェーズで判断する余地。

## 型安全性

- `src/` 配下に `\bany\b` の出現は 0 件（Grep で確認、`: any` / `as any` / `any[]` / `<any>` のいずれもなし）。
- API レスポンスの型は構造化されている：
  - `GET /api/status` → `{ count: number; names: string[] }`（クライアント側 `StatusBoard.tsx:5-8` の `StatusData` と対応）
  - `GET /api/announcements` → `{ id: number; content: string; created_at: string }[]`（クライアント側 `AnnouncementForm.tsx:5-9` の `Announcement` と対応）
  - `POST /api/announcements`, `POST/DELETE /api/checkin` → `{ ok: true } | { error: string }`
- API ハンドラはリクエストボディを `unknown` 経由でナローイング（`as { content?: unknown }` → `typeof body.content === "string"`）しており、信頼境界の扱いは安全。
- TypeScript は `strict: true`（`tsconfig.json:7`）。

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

実行コマンド: `./scripts/run-verify.sh`（exit 0）
生ログ: `docs/evidence/verify-2026-06-11-053933.log`

**判定**: pass

## 残っているギャップ（未検証項目）

静的解析と読み取りでは確認できなかった事項（テスター・運用環境で検証する想定）：

1. **ESLint / Prettier の検証**: パッケージが未インストール（`package.json` に `eslint`, `prettier`, `lint` スクリプトなし）。`/self-review` 所見 #13（INFO）と整合。導入すれば最も低コストで品質ゲートを強化できる。
2. **振る舞い／統合テスト**: API ルートのユニットテスト・統合テストが存在しない（`vitest`/`jest` 未設定）。受け入れ基準は「実装が意図された呼び出しを行う」レベルで確認したが、実際の振る舞いは `/test` フェーズの担当。
3. **AC-7 の動的検証**: 日付境界での `getCheckins` レイジーリセットを実機で 0:00 JST に観測したわけではない（コードレベルでは正しい）。
4. **AC-8 の実 Webhook 検証**: 実 Discord Webhook URL でメッセージが期待形式で届くかは送信していない（fetch 呼び出しと payload 構築は確認済み）。
5. **AC-10 の負パス検証**: `DISCORD_WEBHOOK_URL` 未設定での POST /api/announcements の挙動を実行で確認していない（コード上は early return）。
6. **同時実行・競合**: 複数クライアントが同じ Discord 名で同時にチェックインした場合の `INSERT OR REPLACE` の挙動はテストされていない（SQLite UNIQUE 制約と WAL モードで保護されているが負荷時の振る舞いは未検証）。

## 信頼性を最も高める最小限のチェック追加候補

1. `src/lib/db.ts` の `todayJst()` のテーブル駆動テスト（複数のホスト TZ をモックして JST 日付を返すことを assert）。最小コストで AC-7 の核を固定できる。
2. `POST /api/announcements` を `DISCORD_WEBHOOK_URL` 未設定で叩く統合テスト（AC-10）。
3. `eslint` + `eslint-config-next` の追加（`/self-review` #13）— `verify-typescript.sh` の SKIP が消え、`react-hooks/exhaustive-deps` のような検出も期待できる。

## 結論

**総合判定**: **pass**

- スペック適合：10/10 すべてエビデンスあり
- ドキュメントドリフト：なし
- 静的解析：型チェック PASS、lint/format は未インストール（FAIL ではない）
- 型安全性：`any` ゼロ、API レスポンス型定義済み

`/self-review` で挙げられた HIGH 所見 #1（todayJst のホスト依存）と #3（Discord メンションインジェクション）は本検証時点のコードで対処済み（`Intl.DateTimeFormat` 採用 / `allowed_mentions: { parse: [] }`）。残る #2（Discord 失敗時の API エラー）は `route.ts:18` の `.catch(() => undefined)` による fire-and-forget 化で AC-10 のスペック面は守られているが、レビュー指摘の趣旨（観測性／構造化された警告ログ）は満たしていない — ただしプランの受け入れ基準には含まれず、検証判定は阻害しない。

次のステップ: `/test` を実行する（特に AC-7, AC-10 の動的検証を優先）。
