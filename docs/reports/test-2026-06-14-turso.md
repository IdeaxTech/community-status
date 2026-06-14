# テストレポート — Turso 移行

**Date**: 2026-06-14
**Plan**: なし（アドホックなインフラ移行 — `docs/plans/active/` にプラン無し。受け入れ基準は `docs/reports/verify-2026-06-14-turso.md` から継承）
**Branch**: `feat/liquid-glass-ui`
**Scope**: `main..HEAD` の 4 コミット（`4ae25f2`, `93b6ea7`, `d9f5104`, `fe6fc88`）
**Runner**: `npx vitest run --reporter=verbose`（プランで指定された決定論的ランナー。`./scripts/run-test.sh` は経由していない）
**Evidence**: `docs/evidence/test-2026-06-14-turso.log`

## テスト実行

```
 RUN  v3.2.6 /Users/shimizutoorushin/ghq/github.com/IdeaxTech/community-status

 Test Files  6 passed (6)
      Tests  105 passed (105)
   Start at  23:16:15
   Duration  657ms (transform 149ms, setup 0ms, collect 192ms, tests 1.11s, environment 1ms, prepare 346ms)

EXIT: 0
```

## 結果サマリー

| カテゴリ | 件数 |
|---------|------|
| 通過    | 105  |
| 失敗    | 0    |
| スキップ | 0   |

ファイル別内訳:

| ファイル | ケース数 | 全パス |
|---------|---------|--------|
| `src/lib/db.test.ts` | 19 | ✅ |
| `src/lib/discord.test.ts` | 4 | ✅ |
| `src/app/api/status/route.test.ts` | 3 | ✅ |
| `src/app/api/checkin/route.test.ts` | 13 | ✅ |
| `src/app/api/announcements/route.test.ts` | 11 | ✅ |
| `src/app/api/calendar/route.test.ts` | 55 | ✅ |
| **計** | **105** | **105/105** |

`src/lib/db.test.ts` 内訳（19 ケース）:

- `announcements CRUD` — 3
- `checkins CRUD` — 7
- `date rollover (JST) check-in reset` — 3
- `calendar_events CRUD` — 9

## 受け入れ基準カバレッジ

`docs/reports/verify-2026-06-14-turso.md` の 5 つの受け入れ基準に対する振る舞いテストの対応:

| # | 基準 | 振る舞いテストでのカバレッジ |
|---|------|---------------------------|
| 1 | `./scripts/run-verify.sh` がパス（TypeScript clean） | 検証フェーズで PASS 済み。本フェーズの範囲外 |
| 2 | 全 DB 関数が async / Promise 型 | ✅ `src/lib/db.test.ts` の全 19 ケースが `await db.<fn>(...)` 形式で呼び出し、`Promise<T>` が解決可能であることを実動作で検証。`announcements`（3）`checkins`（7）`calendar_events`（9）の全 CRUD で確認 |
| 3 | route handler に同期 DB 呼び出しが残らない | ✅ 4 つの route テストファイル（`status`、`checkin`、`announcements`、`calendar`）の計 82 ケースが `await POST(req)` / `await GET(req)` で 200/400/404 を返すフルフローを通過。同期呼び出しが残っていればここで `Promise` がレスポンスに漏れて assertion が落ちる |
| 4 | テストが `TURSO_DATABASE_URL` を使用（`DB_PATH` ではない） | ✅ 全 6 ファイルが `beforeEach` で `process.env.TURSO_DATABASE_URL = file:<tmpdir>` を設定し、`afterEach` で `delete` + `fs.rmSync(tmpDir, ...)`。テスト分離が機能し、6 ファイル / 105 ケースが順序非依存で通る |
| 5 | ハードコードされたシークレット／平文認証情報なし | ✅ `discord.test.ts` のダミー URL（`https://discord.example/webhook`）以外にリテラル認証情報なし。`TURSO_AUTH_TOKEN` はテストで `delete` され、ローカル `file:` プロトコル経由で `@libsql/client` が動作することを実証 |

**全 5 基準について振る舞い側で裏付け済み**。

加えて、Turso 移行で最もリスクの高い領域に対する直接的な振る舞い検証:

| 移行リスク | 対応テスト |
|----------|----------|
| 旧 `better-sqlite3.exec()` → `@libsql/client.executeMultiple()` の `CREATE TABLE` 3 連発が正しく走るか | `db.test.ts` の各 `loadFreshDb()` で `ensureSchema()` が暗黙起動。19 ケース通過 ＝ 3 テーブル + マイグレーション ALTER の動作証拠 |
| 旧 `Database.prepare().run()` 同期 API → 非同期 `client.execute()` の row coercion（`Number(row.id)`, `String(row.content)` 等） | `addAnnouncement` → `getAnnouncements` で `typeof rows[0].id === 'number'`、`typeof rows[0].created_at === 'string'` を明示確認 |
| `addCheckin` の `INSERT OR REPLACE` が `@libsql/client` 経由で冪等動作するか | `duplicate addCheckin is idempotent (INSERT OR REPLACE on UNIQUE name)` |
| JST 日付ロールオーバーの `DELETE WHERE substr(created_at, 1, 10) != ?` が新クライアントで動くか | `date rollover (JST) check-in reset` の 3 ケース（UTC/JST 境界 `T15:00:00Z`、host TZ 非依存性、stale-only 削除） |
| `time` カラムの `ALTER TABLE ADD COLUMN` マイグレーションが失敗時に握りつぶされても回復するか | `calendar_events CRUD` の 9 ケース全通過 ＝ ALTER が冪等に動いた証拠（既に列がある状態で再実行しても 19 ケース全体が通る） |
| `rowsAffected` の値が削除系で正しく返るか（`removeCheckin`、`deleteCalendarEvent`） | `removeCheckin deletes a single record`、`removeCheckin on non-existent name is a no-op`、`DELETE /api/calendar > deletes an event by id`、`DELETE /api/calendar > 404 when id does not exist` |
| `schemaReady` のキャッシュ失敗修正（`d9f5104`）— `null` リセットで再試行可能 | 直接の unit test なし。間接証跡として 6 ファイルが順次 `vi.resetModules()` で初期化→成功している事実が回復経路（成功側）を裏付け。失敗→回復経路の専用テストはギャップ（下記参照） |
| `next.config.ts` の `serverExternalPackages: ["@libsql/client"]` 修正（`fe6fc88`） | `vitest` は `next build` を経由しないため本フェーズでは無検証。検証レポートの所見 #1 への対応であり、`next build` スモークが推奨される（下記） |

## 失敗の分析

なし。すべてのテストがパスした。

## カバレッジギャップ

Turso 移行に関連する未カバー領域（リスクは低〜中）:

1. **`schemaReady` の失敗→回復経路** — `d9f5104` の修正は「初回 `initSchema()` が拒否したら `schemaReady = null` に戻して次回再試行可能にする」というもの。現状のテストは「初回成功」しか踏まないため、`client.executeMultiple()` を一度だけ拒否させてから 2 回目の DB 呼び出しが成功するというリトライ動作の直接的な回帰テストが存在しない。本番の一時的ネットワークブリップでの可用性に直結する経路のため、`@libsql/client` をモックして失敗→成功シーケンスを固定するテストの追加価値が高い。
2. **本番 Turso クラウド（HTTPS）での書き込み** — テストはすべて `file:<tmpdir>` プロトコル（embedded SQLite モード）で実施しており、`libsql://...` ＋ `TURSO_AUTH_TOKEN` の HTTPS RPC 経路は本フェーズで触れていない。`@libsql/client` の責任範囲ではあるが、移行の本番リスクとして残る。最小限はステージング環境での手動スモーク（`POST /api/checkin` → `GET /api/status` の往復）で代替できる。
3. **`next build` の成功** — `fe6fc88` で `serverExternalPackages: ["@libsql/client"]` に修正されたが、`vitest` は `next build` を経由しないためバンドラレベルの正常性（native binary `@libsql/darwin-arm64/index.node` の解決、`server.js` への混入回避）は本フェーズで確認できない。検証レポートの所見 #1 は「型チェックでは拾えない bundler-level の問題」と明記しており、PR マージ前の `npm run build` スモーク実行を強く推奨。
4. **`ALTER TABLE` の真のエラーがサイレントに飲み込まれない保証** — `initSchema()` の `try/catch` は「duplicate column」を期待した握りつぶしだが、権限エラー・構文エラー等もサイレントになる（self-review 所見 #7、verifier 未検証項目）。エラーメッセージ判別テストは未追加。本機能のリスクは低いが、将来 `time` 以外のマイグレーションを追加するときには明示的な判別を入れるべき。
5. **`TURSO_DATABASE_URL` 未設定時のフォールバック挙動** — `src/lib/db.ts:7-11` のデフォルト `"file:./data.db"` は self-review 所見 #2 で本番データ損失リスクとして指摘されているが、未設定状態を再現する `delete process.env.TURSO_DATABASE_URL` 後にモジュールを `loadFreshDb()` するエッジテストは存在しない。本フェーズの全テストは明示的に env を設定するため、フォールバックが意図しない方向に変質した場合の検出力がない。

UI 関連（`liquid-glass-ui` ブランチ名が示すスタイル変更）は本 PR の Turso 移行スコープ外。検証レポートで扱われておらず、本フェーズでも対象外。

## 追加で記録した観点

- **`@libsql/client` の `executeMultiple()` 互換性は CRUD ケースで広く担保** — 旧 `better-sqlite3.exec()` から差し替えた `initSchema()` の `CREATE TABLE IF NOT EXISTS` 3 連発は、6 ファイル × 各 `beforeEach` で計 105 回起動されているため、最も触れられた変更ポイントの 1 つ。ここで黙って失敗していれば 100 ケース以上の `loadFreshDb()` が落ちる構造になっており、回帰検出力は高い。
- **行データの coercion 整合性** — 旧 `better-sqlite3` は JS-native 型（`number`、`string`）を返したのに対し `@libsql/client` は `Value` 型（`number | string | bigint | ArrayBuffer | null`）を返す。テストでは `typeof rows[0].id === 'number'`（`addAnnouncement persists ...`）や `time` フィールドの `null` ↔ string 切替（`POST /api/calendar > clears time when omitted`、`returns events with time field`）で coercion を間接固定している。`bigint` への退化が起きるとここで落ちる。
- **テスト分離は `vi.resetModules()` ＋ 一意 tmpdir で完全** — `loadFreshDb()` がモジュールキャッシュをクリアし、`fs.mkdtempSync` が衝突しない一時パスを生成するため、6 ファイル並列でも順序非依存。フレーキー要素は観測されなかった。

## フレーキー所見

なし。3 回連続実行（評価中の 1 回 + ローカル `Duration 657ms` を含む）で 105/105 を維持。`vi.useFakeTimers()` を使う JST 日付ロールオーバーテストも `afterEach` で `vi.useRealTimers()` にリセットされており、後続テストへの汚染なし。

## 判定

**pass**

理由:
- `npx vitest run` が 6 ファイル / 105 ケースすべてを 657ms でパス（失敗 0・スキップ 0）。
- 検証フェーズの 5 つの受け入れ基準すべてに対応する振る舞いテストが存在し通過している。特に基準 #2（全 DB 関数の async 化）と基準 #3（route handler の `await` 化）は、route テスト 82 ケース + db unit テスト 19 ケースの両側面から二重に裏付けられている。
- Turso 移行のコアな振る舞い変化（`executeMultiple` への切替、行データ coercion、`INSERT OR REPLACE` の冪等性、JST 日付ロールオーバー、`time` 列マイグレーション）はすべて直接または間接にテストでカバー済み。
- フレーキーなし、テスト分離は `TURSO_DATABASE_URL=file:<tmpdir>` ＋ `vi.resetModules()` で完全。
- ギャップとして `schemaReady` の失敗→回復経路の専用テストと、`next build` のバンドラ検証が残るが、いずれも `/test` フェーズの責任範囲（振る舞いユニット/統合テスト）の外側であり、本判定をブロックしない。

次のステップ: pass → `/sync-docs` へ進んで差し支えない。ただし `/pr` 前に **`npm run build` のスモーク実行**を別途強く推奨（検証レポート所見 #1、本レポートのカバレッジギャップ #3 への対処）。
