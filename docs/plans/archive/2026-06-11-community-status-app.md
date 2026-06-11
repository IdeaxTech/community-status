# プラン: community-status-app

**Date**: 2026-06-11
**Type**: feat
**Branch**: feat/community-status-app
**Related issue**: N/A
**Related request**: requirements.md

## 目的

技術コミュニティの対面活動（もくもく会）において、現地に行かないと誰がいるか・会場が使えるかわからない問題を解決する。WebアプリとDiscordボット（Webhook通知）を作成し、会場状況のリアルタイム共有を実現する。

## スコープと非ゴール

**スコープ**:
- Next.js (TypeScript) による Web アプリ（App Router）
- 会場状況お知らせ投稿（認証不要）
- チェックイン / チェックアウト（Discord 名の自己申告）
- 日付変わりでのチェックイン自動リセット（JST 基準、レイジー方式）
- SQLite による永続化（better-sqlite3）
- 会場状況投稿時の Discord Incoming Webhook 通知
- もくもく会の開催情報（静的表示）

**非ゴール**:
- ユーザー認証・ログイン機能
- チェックイン履歴の長期保存・分析
- Discord Bot による双方向コマンド応答
- プッシュ通知・メール通知
- 管理者画面

## 前提

- Node.js 環境が利用可能
- デプロイ先はセルフホスト（Railway, Fly.io, VPS など Node.js が常駐するサービス）
- SQLite ファイルはサーバーのファイルシステムに永続化される
- Discord Webhook URL は環境変数 `DISCORD_WEBHOOK_URL` で管理

## 影響ファイル・システム

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # トップページ（閲覧）
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── checkin/route.ts        # POST: チェックイン / DELETE: チェックアウト
│   │       ├── announcements/route.ts  # GET: 一覧 / POST: 投稿
│   │       └── status/route.ts         # GET: 参加者数・名前一覧
│   ├── lib/
│   │   ├── db.ts                       # SQLite 接続・スキーマ初期化
│   │   └── discord.ts                  # Webhook 通知
│   └── components/
│       ├── CheckinForm.tsx
│       ├── AnnouncementForm.tsx
│       └── StatusBoard.tsx
├── package.json
├── next.config.ts
└── .env.local.example
```

## 受け入れ基準

- [ ] トップページにもくもく会の固定開催情報が表示される
- [ ] 会場状況お知らせ一覧が新しい順で表示される
- [ ] 現在の参加者数と Discord 名一覧が表示される
- [ ] 認証なしで会場状況を一言投稿できる
- [ ] Discord 名を入力してチェックインできる
- [ ] チェックアウトで自分の名前を削除できる
- [ ] 日付が変わると（JST 0:00）チェックイン情報が自動リセットされる
- [ ] 会場状況投稿時に Discord Webhook 通知が送信される（投稿内容 + 現在の参加人数）
- [ ] 通常開催時は Discord に通知しない
- [ ] `DISCORD_WEBHOOK_URL` が未設定の場合は通知をスキップしてエラーにならない

## 設計決定

**チェックイン自動リセット（レイジー方式）**: API ルート呼び出し時にチェックイン日付を確認し、当日（JST）でなければ削除する。cron ジョブ不要。

**Discord 通知**: Webhook 専用ライブラリは使わず `fetch` で直接 POST。依存を最小化する。

**SQLite のデプロイ注意**: Vercel Serverless はインスタンス間でファイルシステムを共有しないため、SQLite はセルフホスト環境でのみ正しく動作する。Vercel を使う場合は後日 Turso 等への切り替えが必要。

## 実装概要

1. **プロジェクト初期化** — `npx create-next-app` (TypeScript, App Router, Tailwind CSS) + `better-sqlite3` インストール
2. **DB 層** (`src/lib/db.ts`) — SQLite 接続・テーブル作成（`announcements`, `checkins`）、チェックイン日付リセット関数
3. **API ルート実装**
   - `GET /api/status` — 今日のチェックイン一覧
   - `POST /api/checkin` — チェックイン
   - `DELETE /api/checkin` — チェックアウト
   - `GET /api/announcements` — お知らせ一覧（降順）
   - `POST /api/announcements` — 投稿 + Discord Webhook 通知
4. **Discord 通知層** (`src/lib/discord.ts`) — `sendAnnouncement(content, attendeeCount)`: `DISCORD_WEBHOOK_URL` 未設定ならノーオペレーション
5. **UI コンポーネント実装** — `StatusBoard`・`CheckinForm`・`AnnouncementForm`・`page.tsx`
6. **環境変数テンプレート** (`.env.local.example`)

## ベリファイプラン

- 静的解析: `./scripts/run-verify.sh`（TypeScript 型チェック含む）
- スペック適合: 受け入れ基準を 1 つずつ手動確認
- ドキュメントドリフト: `.env.local.example` が実装と一致するか確認
- 型安全性: `any` 使用なし、すべての API レスポンス型が定義済み

## テストプラン

- ユニットテスト: `src/lib/db.ts` の CRUD 関数・`src/lib/discord.ts` のノーオペレーション動作
- 統合テスト: 各 API ルートの正常系・異常系（不正入力、空文字、重複チェックイン）
- エッジケース:
  - 日付をまたいだチェックインリセット
  - `DISCORD_WEBHOOK_URL` 未設定時の投稿
  - Discord 名に特殊文字が含まれる場合

## リスクレジスター

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| Vercel で SQLite ファイルがインスタンス間共有されない | データ不整合 | 高（Vercel の場合） | セルフホスト推奨 |
| Discord Webhook URL の漏洩 | スパム投稿被害 | 低 | `.env.local` に保存・`.gitignore` 確認 |
| 名前の成りすまし | 信頼性低下 | 中 | 要件上許容（認証不要コミュニティアプリ） |

## ロールアウト・ロールバック

- ロールアウト: PR マージ → デプロイ（Railway / Fly.io / VPS）、`DISCORD_WEBHOOK_URL` 環境変数を設定
- ロールバック: PR を revert → 再デプロイ

## 進捗チェックリスト

- [x] 実装完了
- [x] `./scripts/run-verify.sh` パス
- [x] `/self-review` 完了（`docs/reports/self-review-2026-06-11-community-status-app.md`）
- [x] `/verify` 完了（`docs/reports/verify-2026-06-11-community-status-app.md`、判定 pass）
- [x] `/test` 完了（`docs/reports/test-2026-06-11-community-status-app.md`、44/44 pass）
- [x] `/sync-docs` 完了（README.md を新規作成、進捗チェックリスト更新）
- [ ] `/pr` 作成済み
