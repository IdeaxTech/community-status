# community-status

技術コミュニティ（もくもく会）の現地状況を共有するための Web アプリと Discord 通知。

「現地に行かないと誰がいるか・会場が使えるかわからない」問題を、認証不要のチェックイン・お知らせ投稿と Discord Incoming Webhook 通知で解消する。

要件詳細: [`requirements.md`](./requirements.md)
最新プラン: [`docs/plans/active/2026-06-14-ui-redesign.md`](./docs/plans/active/2026-06-14-ui-redesign.md)

## 機能

- もくもく会の固定開催情報の静的表示（会場・チャンネル・本日のセッション状態バッジ）
- 会場状況お知らせ投稿（認証不要）と新しい順での一覧表示
- Discord 名の自己申告によるチェックイン / チェックアウト
  - ステータスは `at_venue`（在席中）/ `on_the_way`（向かっています）から選択
- 日付（JST 0:00）が変わるとチェックインを自動リセット（レイジー方式）
- お知らせ投稿時に Discord Incoming Webhook へ通知（投稿内容 + 現在の参加人数）
  - `DISCORD_WEBHOOK_URL` が未設定の場合は通知をスキップしてエラーにならない
- 月次カレンダー表示（前月・次月ナビゲーション付き）
  - 毎週木曜日に「もくもく会 13:00〜20:00」を自動表示（DB 非保存・クライアント側で日付計算）
  - 日付セルをクリックして任意のイベントを追加可能（認証不要、title 100 文字以内）

## 技術スタック

- **フレームワーク**: Next.js 15（App Router）+ React 19
- **言語**: TypeScript（`strict: true`）
- **スタイル**: Tailwind CSS（ライト/ダーク両対応の CSS 変数テーマ、`prefers-color-scheme` で自動切替）
- **フォント**: `next/font/google` でセルフホストする Inter（外部 `@import` ではなくビルド時取り込み）
- **永続化**: SQLite（`better-sqlite3`、WAL モード）
- **通知**: Discord Incoming Webhook（`fetch` で直接 POST）+ クライアント側トースト（`useToast` / `Toaster`）
- **テスト**: Vitest

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                    # トップページ（MainPage をマウント）
│   ├── layout.tsx
│   └── api/
│       ├── announcements/route.ts  # GET 一覧 / POST 投稿 + Discord 通知
│       ├── calendar/route.ts       # GET 月別イベント / POST 追加 / PUT 編集 / DELETE 削除
│       ├── checkin/route.ts        # POST チェックイン / DELETE チェックアウト
│       └── status/route.ts         # GET 参加者数・参加者一覧（attendees: {name, status}[]）
├── lib/
│   ├── db.ts                       # SQLite 接続・スキーマ初期化・CRUD
│   └── discord.ts                  # Webhook 通知（未設定時はノーオペ）
├── hooks/
│   └── useToast.ts                 # トースト通知フック
└── components/
    ├── MainPage.tsx                # ページルート（HeroCard + AnnouncementForm + CalendarView）
    ├── HeroCard.tsx                # チェックイン・参加者表示・セッション状態バッジ
    ├── Toaster.tsx                 # トースト通知 UI
    ├── AnnouncementForm.tsx        # 会場状況お知らせ投稿・一覧
    └── CalendarView.tsx            # 月次カレンダー UI
```

## ローカル実行

前提: Node.js（LTS）と npm。

```sh
# 1. 依存のインストール
npm install

# 2. 環境変数ファイルを用意
cp .env.local.example .env.local
# 必要なら DISCORD_WEBHOOK_URL を設定。未設定でも起動・動作可能（通知のみスキップ）。

# 3. 開発サーバー起動（http://localhost:3000）
npm run dev
```

その他のスクリプト:

```sh
npm run build       # 本番ビルド
npm run start       # 本番サーバー起動（要 build）
npm run type-check  # tsc --noEmit
npm test            # vitest run
```

## 環境変数

[`.env.local.example`](./.env.local.example) に同期。

| 変数 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `DISCORD_WEBHOOK_URL` | 任意 | （未設定） | Discord Incoming Webhook URL。未設定時はお知らせ投稿時の通知をスキップする |
| `DB_PATH` | 任意 | `./data.db` | SQLite データベースファイルのパス |

`.env.local` および `*.db` / `*.db-shm` / `*.db-wal` は `.gitignore` で除外済み。

## データベース

- 初回アクセス時に `better-sqlite3` が `DB_PATH` のファイルを作成し、`announcements` / `checkins` / `calendar_events` テーブルを `CREATE TABLE IF NOT EXISTS` で初期化する。
- `journal_mode = WAL` を有効化。
- `checkins` の自動リセットは API ルート呼び出し時に `getCheckins()` が JST の今日でない行を `DELETE` する（cron 不要のレイジー方式）。
- `checkins.status` カラム（`"at_venue"` / `"on_the_way"`）は `ALTER TABLE … ADD COLUMN` で既存 DB に追加（起動時に try-catch で冪等適用）。
- `calendar_events.time` カラム（`HH:MM` 文字列、nullable）も同様に冪等マイグレーション済み。

## デプロイ

SQLite を永続ファイルとして保持できる**セルフホスト環境**を推奨する（Railway / Fly.io / VPS / Docker など Node.js プロセスが常駐するサービス）。

最小手順:

1. リポジトリをデプロイ先にクローン or push。
2. デプロイ環境の環境変数に `DISCORD_WEBHOOK_URL` を設定（任意）。永続ボリュームに合わせて `DB_PATH` を設定（例: `/data/data.db`）。
3. `npm install && npm run build && npm run start` を実行する設定にする。
4. `DB_PATH` が指す場所が永続ボリューム上にあることを確認する。

### Vercel について

Vercel Serverless はインスタンス間でファイルシステムを共有しないため、`better-sqlite3` ベースの SQLite はインスタンス間でデータが揃わない。Vercel にデプロイする場合は Turso / LibSQL などのネットワーク型 SQLite、もしくは別の DB へ差し替える必要がある（プラン `設計決定` 参照）。

## 開発フロー

このリポジトリは Claude Code のスキル／サブエージェント／フックを使ったポストパイプライン（`/self-review` → `/verify` → `/test` → `/sync-docs` → `/pr`）で品質ゲートを通している。詳細は [`CLAUDE.md`](./CLAUDE.md) と [`.claude/rules/post-implementation-pipeline.md`](./.claude/rules/post-implementation-pipeline.md) を参照。

完了宣言の前に必ず以下を実行する:

```sh
./scripts/run-verify.sh
./scripts/run-test.sh
```
