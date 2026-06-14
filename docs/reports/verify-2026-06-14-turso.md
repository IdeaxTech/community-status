# 検証レポート — Turso 移行

**Date**: 2026-06-14
**Branch**: `feat/liquid-glass-ui`
**Scope**: `main..HEAD` の 3 コミット（`4ae25f2`, `93b6ea7`, `d9f5104`）
**Static verifier**: `./scripts/run-static-verify.sh` → **PASS**（typescript 型チェックのみ実行、eslint/prettier は SKIP）
**Evidence**: `docs/evidence/verify-2026-06-14-135333.log`

## サマリー

`better-sqlite3` から `@libsql/client` への移行は実装面（`src/lib/db.ts` と 5 つの API ルート、5 つのテストファイル）では完全かつ一貫している。型チェックは PASS、async/await 化は全関数で網羅、テスト分離も `TURSO_DATABASE_URL=file:<tmpdir>` に切り替わっている。

ただし **移行スコープ外の補助ファイル 4 件で参照漏れが残っており**、契約とドキュメント／設定が振る舞いと同期していない。最も影響が大きいのは `next.config.ts` の `serverExternalPackages: ["better-sqlite3"]` で、これは Next.js が native binary を持つ `@libsql/client` を bundle しようとする原因となり得る本番リスク。

**判定**: **conditional pass** — 静的解析は通るが、`next.config.ts` の修正は本番デプロイ前に必須。残り 3 件はドキュメント／コメント差分につき `/sync-docs` に委ねる。

## 受け入れ基準ごとの結果

| # | 基準 | 結果 | 根拠 |
|---|------|-----|------|
| 1 | `./scripts/run-verify.sh` がパス（TypeScript clean） | **PASS** | `./scripts/run-static-verify.sh` 実行 → `PASS=1 FAIL=0 SKIP=2`、tsc `--noEmit` クリーン。`docs/evidence/verify-2026-06-14-135333.log` に記録 |
| 2 | 全 DB 関数が async / Promise 型 | **PASS** | `src/lib/db.ts` の 10 個の公開関数すべてが `export async function ... : Promise<T>` シグネチャ（行 66, 78, 92, 97, 112, 121, 126, 144, 152, 161）。`CheckinStatus` 型エクスポート（行 64）も健在 |
| 3 | route handler に同期 DB 呼び出しが残らない | **PASS** | grep `(getAnnouncements\|addAnnouncement\|getCheckins\|addCheckin\|removeCheckin\|getTodayAnnouncements\|getCalendarEvents\|addCalendarEvent\|updateCalendarEvent\|deleteCalendarEvent)\(` を全 5 ルート（announcements, calendar, checkin, status, discord-notify）で確認し、すべて `await` 付き。`void sendAnnouncement(...)` の fire-and-forget も意図通り |
| 4 | テストが `TURSO_DATABASE_URL` を使用（`DB_PATH` ではない） | **PASS（ソースコードのみ）** | 6 テストファイル（`src/lib/db.test.ts` + 4 ルートテスト + `discord.test.ts` は db を使わない）が `process.env.TURSO_DATABASE_URL = "file:..."` を `beforeEach` で設定し、`afterEach` で `delete` している。**注**: `vitest.config.ts:13` のコメントに `DB_PATH` が残存（下記 #2 参照） |
| 5 | ハードコードされたシークレット／平文認証情報なし | **PASS** | `TURSO_AUTH_TOKEN` は `process.env` 経由のみ（`src/lib/db.ts:9`）。`CRON_SECRET` も同様（`discord-notify/route.ts:26`）。テスト内のリテラル URL（`https://discord.example/webhook`）はダミーで実シークレットではない |

**全 5 基準パス**。

## 所見

| # | 深刻度 | 種別 | 場所 | 説明 |
|---|--------|-----|------|------|
| 1 | **HIGH** | 設定の不整合 / 本番リスク | `next.config.ts:4` | `serverExternalPackages: ["better-sqlite3"]` が古いまま。`@libsql/client` は `node_modules/@libsql/darwin-arm64/index.node`（7.8MB の native binary）を含み、本来 Next.js bundle から除外する必要がある。`@libsql/client` に置き換える（あるいは追加する）べき。型チェックは通るが、`npm run build` 後の Vercel/Node 実行時に `.node` ファイル解決エラーが出る可能性がある |
| 2 | LOW | コメント／ドキュメント | `vitest.config.ts:13` | `Each test file gets its own DB_PATH` の `DB_PATH` が古いまま。`TURSO_DATABASE_URL` に更新が必要。振る舞いには影響しないが、将来の保守者を混乱させる。**`/sync-docs` の範囲** |
| 3 | LOW | ドキュメント | `.env.local.example:5-6` | コメントの `# DB_PATH=/path/to/data.db` が古い。`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` に更新が必要。self-review の所見 #9 でも指摘済み。**`/sync-docs` の範囲** |
| 4 | LOW | ドキュメント | `README.md:90, 96, 109, 111, 115` | 環境変数表、データベース説明、デプロイ手順、Vercel 注意書きが `DB_PATH` / `better-sqlite3` を参照したまま。**`/sync-docs` の範囲**（contractとの大きな乖離） |
| 5 | INFO | 監視済み | self-review #1 の対応 | `d9f5104` コミットで `schemaReady` のキャッシュ失敗問題（self-review 所見 #1）は既に修正済み（`src/lib/db.ts:47-50` の `.catch((err) => { schemaReady = null; throw err; })`）。再検証で確認 |

## 静的解析の詳細

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
```

- `tsc --noEmit` クリーン。`Promise<T>` 化された API シグネチャと全呼び出し側 `await` が型レベルで整合
- eslint / prettier はプロジェクトに設定されていないため SKIP（移行とは独立した既存状態）
- `package-lock.json` で `better-sqlite3` の occurrence は 0、`@libsql/client` は 1。依存関係は正しく差し替わっている
- `node_modules/better-sqlite3` は不在、`node_modules/@libsql/{client,core,darwin-arm64,hrana-client,isomorphic-ws}` は存在 → install 状態クリーン

## 未検証項目（テスターに引き継ぐ）

静的解析と契約適合性は確認済みだが、以下は振る舞いテストの範囲につき `/test` フェーズで検証されるべき：

- **テストスイート実行**: 全 6 テストファイル（announcements, calendar, checkin, status route + db + discord）の `vitest run` 結果。`fs.mkdtempSync` + `file:` URL での実 SQLite 書き込みが分離されているかは振る舞い検証が必要
- **`schemaReady` リトライの実動作**: `d9f5104` の修正が一時的失敗からの回復を実現するか（unit test 不在）
- **`@libsql/client` の `executeMultiple` が `CREATE TABLE` 3 連発を正しく処理するか**: 旧 `better-sqlite3.exec()` との挙動同等性
- **`ALTER TABLE` の `try/catch` 握りつぶし**: 「duplicate column」以外の真のエラーがサイレントに飲み込まれないか（self-review #7）
- **本番（Turso クラウド）での書き込み**: `file:` プロトコルでのテストは実 Turso HTTPS エンドポイントの動作を保証しない
- **`next build` の成功**: `serverExternalPackages` 設定が古いまま production build を通すか（所見 #1 に直結）

## 最小限の信頼性向上チェック

優先度順に 3 つ：

1. **所見 #1 の修正**: `next.config.ts` の `serverExternalPackages` を `["@libsql/client"]` に更新（または `better-sqlite3` を除去）。3 文字の編集で本番 bundling リスクを解消できる
2. **`npm run build` のスモーク実行**: 本 PR でビルドが通ることを確認すれば、native binary 解決とサーバーバンドリングの正常性が一度に取れる
3. **`/sync-docs` フェーズで所見 #2-4 を一括対処**: `.env.local.example`, `vitest.config.ts:13`, `README.md` の `DB_PATH` / `better-sqlite3` 参照を `TURSO_DATABASE_URL` / `@libsql/client` に書き換える

## 判定

**conditional pass** — 受け入れ基準 5/5 はすべて達成、静的解析は PASS、ただし `next.config.ts:4` の HIGH 所見は本番デプロイ前に修正必須。残りはドキュメント差分につき `/sync-docs` 経由で対処可能。

`/test` フェーズに進んで差し支えないが、所見 #1 については本検証では機能影響を完全に保証できない（`tsc` が拾えない bundler-level の問題）ため、テスト後の `next build` 実行を強く推奨。
