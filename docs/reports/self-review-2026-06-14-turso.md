# 自己レビューレポート

**Date**: 2026-06-14
**Plan**: なし（アドホックなインフラ移行 — `docs/plans/active/` にプラン無し）
**Diff**: `main..feat/liquid-glass-ui`（コミット `93b6ea7` および `4ae25f2`）

対象ファイル（12 ファイル、+293 / -296 行）：
- `package.json` — 依存差し替え（`better-sqlite3` → `@libsql/client`、`@types/better-sqlite3` 削除）
- `src/lib/db.ts` — 完全書き直し、全公開関数を非同期化
- `src/app/api/{announcements,calendar,checkin,status,discord-notify}/route.ts` — 呼び出し側を await 化
- `src/app/api/{announcements,calendar,checkin,status}/route.test.ts` と `src/lib/db.test.ts` — テスト await 化 + `DB_PATH` → `TURSO_DATABASE_URL=file:...` への env 切替

## サマリー

機械的かつ網羅的な移行で、形そのものはクリーン。全 6 つの DB 関数（announcements / checkins / calendar の CRUD）が一貫した `await ensureSchema()` → `await getClient().execute(...)` パターンを採用しており、すべての呼び出し元（5 つのルート + 5 つのテストファイル + ライブラリテスト）が漏れなく更新されている。ただし、**永続的スキーマ初期化失敗キャッシュ** という潜在的な可用性問題が 1 件あり、本番に出る前に対処を推奨。それ以外はマージ可能な品質。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | MEDIUM | 例外処理 / 可用性 | `src/lib/db.ts:44-48` | `schemaReady` が拒否プロミスをキャッシュし続ける — 初回 `initSchema()` 失敗（一時的なネットワークブリップなど）後、以降の DB 呼び出しが永続的に同じ拒否を返す。プロセス再起動まで回復不能。 |
| 2 | MEDIUM | セキュリティ / 保守性 | `src/lib/db.ts:7-11` | `TURSO_DATABASE_URL` 未設定時のフォールバック `"file:./data.db"` が暗黙に動く。本番で env 設定漏れに気付かず、ローカルファイル DB に書き込んでデータ損失や不整合を招くリスク。少なくとも本番（`NODE_ENV === "production"` または `VERCEL`）では明示的にスローしたい。 |
| 3 | LOW | 不要な変更 | `src/app/api/calendar/route.ts:30-31,36,46-50,57-59` | 移行と無関係な「複数行 if を 1 行 if に圧縮」スタイル変更。レビュー対象が混ざり、git blame と diff ノイズを増やす。スタイル統一が目的なら別 PR が望ましい。 |
| 4 | LOW | 不要な変更 | `src/app/api/status/route.ts:8` 削除 | `// Keep backward-compat field` コメント削除は移行と無関係。`names` フィールド自体は残っており、なぜ削除されたか説明がない（コメントは依然として正確）。 |
| 5 | LOW | 不要な変更 | `src/app/api/announcements/route.ts:8-13` | `count` 一時変数を削除して `checkins.length` をインライン化する変更は移行と無関係。意味は等価だが、別 PR が望ましい。 |
| 6 | LOW | 防御的チェック | `src/lib/db.ts:153,162` | `(r.rowsAffected ?? 0) > 0` の `?? 0` は不要。`@libsql/core` の `ResultSet.rowsAffected` は `number` 型（`undefined` 可能性なし）。`r.rowsAffected > 0` で十分。 |
| 7 | LOW | 保守性 | `src/lib/db.ts:14-42` | `ALTER TABLE` を `try/catch` で握りつぶしてマイグレーションする手法は better-sqlite3 時代を踏襲しているが、コメント `/* already exists */` は仮定でしかない。本物のエラー（権限、構文）もサイレントに飲み込まれる。エラーメッセージで `duplicate column` を判別するなど、より精密にできる。 |
| 8 | LOW | テスト保守性 | `src/lib/db.test.ts:14,17` | `dbPath` 変数は `TURSO_DATABASE_URL` 構築だけに使われ、`afterEach` では参照されていない。`tmpDir` のみで足りる（`fs.rmSync(tmpDir, ...)` で十分）。`dbPath` 変数の存在意義が薄い。 |
| 9 | INFO | ドキュメント | `.env.local.example:5-6` | コメントが古い `DB_PATH` を参照したまま。`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` への更新が必要。**`/sync-docs` の担当範囲**につき、ここでは指摘のみ。 |

## ブロッキングな問題

**CRITICAL 所見なし。** マージブロッカーは存在しない。

ただし所見 #1（`schemaReady` の永続キャッシュ失敗）は **本番デプロイ前に修正推奨**。Vercel 等のサーバレスではコールドスタートで何度も初期化される一方、温かいインスタンスで一度ネットワークブリップが起きるとそのインスタンスが「死んだまま生き続ける」リスクがある。修正案：

```ts
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((err) => {
      schemaReady = null;  // 失敗時にキャッシュをクリアして次回再試行を可能にする
      throw err;
    });
  }
  return schemaReady;
}
```

所見 #2 も本番でデータ損失/不整合に直結しうるため、合わせて対処したい。

## フォローアップ提案

- **所見 #3-5**: スタイル変更は次回別 PR にまとめると履歴が読みやすい。今回はサイズが小さいので同 PR でも実害なし。
- **所見 #6**: クリーンアップのみ。マージ後の小修正で可。
- **所見 #7**: 既存 better-sqlite3 コードからの忠実な移植であり、振る舞いは等価。優先度は低いが、将来の保守者のために `if (!/duplicate column/i.test(String(err))) throw err` 程度の精密化を検討。
- **所見 #8**: テストリファクタの範囲。
- **所見 #9**: `/sync-docs` フェーズで対応されるはず。

## 確認済み項目

- [x] **不要な変更** — 所見 #3-5 で 3 件検出。移行と無関係なスタイル変更があるが軽微。
- [x] **命名の一貫性** — `db` / `client` の使い分けは明確。`getClient()` への改名も `better-sqlite3` の `Database` 概念からの脱却を反映していて適切。
- [x] **可読性** — 短い式の 1 行化（`if (...) return ...`）が散見されるが、ガード節として読みやすい範疇。`getCheckins` の DELETE→SELECT 順序や `todayJst` のロジックは旧コードを忠実に保持。
- [x] **タイポ・コピペミス** — 検出なし。全 6 つの公開関数で `await ensureSchema()` → `await getClient().execute(...)` の構造が一貫。`Number(row.id)` / `String(row.content)` の row coercion も全関数で統一。
- [x] **null 安全性** — `time` フィールドは `row.time != null ? String(row.time) : null` で適切に処理。`time ?? null` で SQL 引数に渡しており `@libsql/core` の `Value` 型と整合。
- [x] **デバッグコード** — `console.log` / `print` / TODO マーカー / コメントアウトコードなし。
- [x] **シークレット・認証情報** — ハードコードなし。`TURSO_AUTH_TOKEN` は env からのみ参照。
- [x] **例外処理** — 所見 #1 で 1 件指摘。`initSchema` の `ALTER TABLE` 握りつぶしは旧実装を踏襲（所見 #7）。`addAnnouncement` 等は呼び出し側で try/catch していないが、Next.js のルートハンドラがエラーを 500 に変換するので致命的ではない（旧実装も同じ）。
- [x] **セキュリティ** — SQL 注入：全クエリがパラメータ化されており安全。`title.slice(0, 100)` の上限も保持。`time` は `TIME_RE` で検証済み。所見 #2 で env フォールバックの本番リスクを指摘。
- [x] **保守性** — 公開 API シグネチャが `T → Promise<T>` に一律変更されており、呼び出し側はすべて追従済み。`CheckinStatus` 型もエクスポート位置が変わっただけで意味は不変。

## 判定

**修正後マージ**（所見 #1 を本番デプロイ前に修正）

理由:
- diff の構造的品質は高く、移行は機械的かつ完全。全 5 ルート + 6 テストファイルが一貫したパターンで更新されている。
- CRITICAL レベルの問題（データ破壊、認証バイパス、明白な未定義動作）はゼロ。テスト分離も `TURSO_DATABASE_URL=file:<tmpdir>` への切り替えで正しく機能している。
- ただし所見 #1 の「拒否プロミスの永続キャッシュ」は本番可用性に直結する真の問題であり、3 行で修正できるためマージ前に対処すべき。
- 所見 #2-8 は単独ではブロッカーではなく、別 PR / フォローアップで対処可能。
- ドキュメント差分（所見 #9）は `/sync-docs` の担当領域につき、本レビューの判定には含めない。
