# SQLite on Vercel の制限

## ステータス
**解消済み**（2026-06-14、`feat/liquid-glass-ui` ブランチで `better-sqlite3` → `@libsql/client` (Turso) に移行）

## 経緯
SQLite ファイルは Vercel Serverless のインスタンス間でファイルシステムを共有しないため、複数インスタンスにスケールした際にデータ不整合が発生していた。

## 対応
- `src/lib/db.ts` を `@libsql/client` ベースに書き換え、`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` でネットワーク型 libSQL（Turso クラウド）に接続するよう変更
- 環境変数未設定時は `file:./data.db` にフォールバック（ローカル開発・テスト用）
- 詳細は `docs/reports/verify-2026-06-14-turso.md` / `docs/reports/test-2026-06-14-turso.md` を参照

## 残課題
なし（セルフホスト環境でファイルベース運用したい場合は `TURSO_DATABASE_URL` を未設定にすればよい）。
