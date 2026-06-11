# テストレポート

**Date**: 2026-06-11
**Plan**: docs/plans/active/2026-06-11-community-status-app.md
**Branch**: feat/community-status-app
**Evidence**: docs/evidence/test-2026-06-11-054505.log

## テスト実行

```
$ ./scripts/run-test.sh
# Test run
- Timestamp: 2026-06-11T05:45:05Z

==> Running local test runner
==> npx vitest run

 RUN  v3.2.6 /Users/shimizutoorushin/ghq/github.com/IdeaxTech/community-status

 (44 tests across 5 files — all ✓)

 Test Files  5 passed (5)
      Tests  44 passed (44)
   Start at  14:45:06
   Duration  637ms

==> すべてのテストがパスしました。
Evidence saved to: docs/evidence/test-2026-06-11-054505.log
```

## 結果サマリー

| カテゴリ | 件数 |
|---------|------|
| 通過    | 44   |
| 失敗    | 0    |
| スキップ | 0   |

### ファイル別

| ファイル | テスト数 | 結果 |
|---------|---------|------|
| `src/lib/db.test.ts` | 12 | 12 pass |
| `src/lib/discord.test.ts` | 4 | 4 pass |
| `src/app/api/checkin/route.test.ts` | 13 | 13 pass |
| `src/app/api/status/route.test.ts` | 3 | 3 pass |
| `src/app/api/announcements/route.test.ts` | 12 | 12 pass |

## テストインフラのセットアップ（このフェーズで追加）

プラン作成時点ではテストフレームワークが未インストールだったため、以下を整備した：

- `vitest@3.2.6` を `devDependencies` に追加
- `vitest.config.ts` — Node 環境、`@/*` エイリアス、`forks` プールでファイル間隔離
- `scripts/test.local.sh` — `./scripts/run-test.sh` から呼ばれるシム（`npx vitest run --reporter=verbose`）
- `package.json` に `"test": "vitest run"` スクリプトを追加

これにより `./scripts/run-test.sh` がそのまま vitest を実行できる状態になった。

## テストカバレッジ — テストプラン項目との対応

プラン `テストプラン` セクション（line 104–112）の各項目：

### ユニットテスト

- **`src/lib/db.ts` の CRUD 関数** → 12 ケースで網羅
  - `announcements`: empty / 永続化 + 新しい順 / 特殊文字保存
  - `checkins`: empty / 追加 / 冪等な重複追加 / 複数件 / 削除 / 存在しないものの削除 / 特殊文字を含む名前
- **`src/lib/discord.ts` のノーオペレーション動作** → 4 ケース
  - `DISCORD_WEBHOOK_URL` 未設定 / 空文字 → `fetch` 未呼び出し
  - 設定済み → 正しい URL・本文・`allowed_mentions: { parse: [] }` を送信
  - 特殊文字をそのまま埋め込み

### 統合テスト（API ルート — handler を直接呼び出し）

- **`/api/checkin` POST / DELETE** → 13 ケース
  - happy path / トリム / 400 系（空・空白のみ・欠落・型違い・null）/ 重複チェックインの冪等性 / 特殊文字
- **`/api/status` GET** → 3 ケース
  - 0 人 / 複数件 / 特殊文字保持
- **`/api/announcements` GET / POST** → 12 ケース
  - 一覧の降順返却 / happy path / 400 系（空・空白のみ・欠落・型違い）/ トリム / Webhook 未設定時の fetch 非呼び出し / 設定時の fetch 呼び出し（URL・content・人数・`allowed_mentions` 検証）/ Webhook 失敗時も API は 200

### エッジケース

- **日付をまたいだチェックインリセット（JST）** → 3 ケース（`vi.useFakeTimers()` で UTC を制御）
  - 前日の check-in が次の `getCheckins()` で削除される
  - 14:59:59Z（JST 6/11 23:59:59）→ 15:00:00Z（JST 6/12 00:00:00）で reset 境界を検証
  - 同日内の異なる UTC モーメントの check-in は同居する
- **`DISCORD_WEBHOOK_URL` 未設定時の投稿** → `discord.test.ts` と `announcements/route.test.ts` の両方で fetch 非呼び出しを検証
- **Discord 名の特殊文字** → 日本語・絵文字・`#1234`・空白入り・ドット・アポストロフィー・`<script>` を db / checkin POST / status GET の各レイヤーで検証

## 失敗の分析

なし — 全 44 ケース通過。

## カバレッジギャップ

以下は今回テストしていないか、薄い：

1. **UI コンポーネント（React）テスト**
   - `MainPage` / `StatusBoard` / `CheckinForm` / `AnnouncementForm` の振る舞いテストはなし。
   - 影響: フォーム検証・楽観的更新・エラーステートのリグレッションは検知できない。
   - 対応案: 必要になった時点で `@testing-library/react` + `jsdom` 環境を追加。今回のプランは API レイヤーまでが MVP として明示されているため未追加。

2. **E2E（実 HTTP）テスト**
   - ルート handler を Node 側で直接呼び出している。`next start` を立てて HTTP 経由で叩く E2E は未整備。
   - 影響: Next.js のミドルウェア・ルーティング層の挙動はカバーされない（現状ミドルウェアなし）。
   - 対応案: 不要と判断（追加コストが回収できる仕様変更が来たら検討）。

3. **同時実行・並行 check-in**
   - 同名同時 INSERT のレース条件は SQLite の UNIQUE 制約 + `INSERT OR REPLACE` に委譲。明示テストはなし。
   - 影響: better-sqlite3 は同期 API なので Node の単一スレッド内では実害なし。

4. **`getCheckins()` の DELETE 副作用の観測性**
   - `getCheckins()` は副作用として「当日でない行を削除」する。今回のテストはこの副作用を「次に観測される行数」で間接検証している。`DELETE` 文の発行回数や WAL の挙動までは検証していない。
   - 影響: 実装変更で sweep がスキップされる回帰が起きた場合、検出はできる（前日の check-in が残るため）。

5. **`POST /api/announcements` の Discord fire-and-forget の完全な待機**
   - `void sendAnnouncement(...).catch(...)` を `setImmediate` で 1 tick 待っているが、テストプロセスが終了する前に fetch が確実にディスパッチされるかは環境依存。今回は fetch がモックで同期的にレスポンス化されているため安定している。

6. **DB マイグレーション / スキーマ進化**
   - 現状はスキーマが固定で `CREATE TABLE IF NOT EXISTS` のみ。将来カラム追加時のマイグレーションパスはこのプランの非ゴール。

## 受け入れ基準との対応（テストでカバーされた範囲）

| 受け入れ基準 | テストでの検証 |
|------|--------|
| 会場状況お知らせ一覧が新しい順で表示される | `announcements/route.test.ts` (GET newest-first), `db.test.ts` (getAnnouncements newest-first) |
| 現在の参加者数と Discord 名一覧が表示される | `status/route.test.ts` (count + names) |
| 認証なしで会場状況を一言投稿できる | `announcements/route.test.ts` (POST happy path) |
| Discord 名を入力してチェックインできる | `checkin/route.test.ts` (POST happy path) |
| チェックアウトで自分の名前を削除できる | `checkin/route.test.ts` (DELETE removes existing) |
| 日付が変わると（JST 0:00）チェックイン情報が自動リセットされる | `db.test.ts` (date rollover 3 cases) |
| 会場状況投稿時に Discord Webhook 通知が送信される（投稿内容 + 現在の参加人数） | `announcements/route.test.ts` (calls webhook with content + count) |
| `DISCORD_WEBHOOK_URL` が未設定の場合は通知をスキップしてエラーにならない | `discord.test.ts` (no-op unset/empty), `announcements/route.test.ts` (no fetch when unset) |
| トップページにもくもく会の固定開催情報が表示される | UI コンポーネントテスト未整備のため未検証（静的表示のため低リスク） |
| 通常開催時は Discord に通知しない | 設計上 Discord 通知は `POST /api/announcements` のみが呼ぶ。他経路から `sendAnnouncement` が呼ばれないことは grep で確認済み（コード構造上の不変条件）。 |

## 判定

**pass**

理由:
- プランのテストプランで定義された 3 カテゴリ（ユニット / 統合 / エッジケース）をすべて網羅した。
- 44 件すべて通過、失敗・スキップ・フレーキーなし。
- 主要な受け入れ基準のうち、振る舞いとして検証可能なものはすべてテストでカバーされている。
- 未カバーの領域（UI / E2E）はプランの非ゴールまたは MVP スコープ外であり、明示的にギャップとして記録した。

次のステップ: pass → `/sync-docs` へ
