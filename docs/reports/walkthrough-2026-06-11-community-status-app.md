# ウォークスルー: community-status-app

**Date**: 2026-06-11
**Branch**: feat/community-status-app
**Diff**: 3 commits, 19 files changed, 1291 insertions

## 概要

もくもく会の現地状況を共有する Web アプリを新規構築。Next.js (TypeScript) + SQLite + Discord Incoming Webhook の構成。

---

## コア実装

### `src/lib/db.ts`
SQLite 接続・スキーマ初期化・全 CRUD 関数を担う。
- `todayJst()`: `Intl.DateTimeFormat` で JST 日付をホスト TZ 非依存に取得
- `getCheckins()`: 呼び出し時に当日以外のレコードをレイジー削除（cron 不要）
- `addCheckin()`: `INSERT OR REPLACE` で同名の重複チェックインを上書き

### `src/lib/discord.ts`
Discord Incoming Webhook への通知。
- `DISCORD_WEBHOOK_URL` が未設定なら即 return（no-op）
- `allowed_mentions: { parse: [] }` で `@everyone` 等のメンション注入を防止

### `src/app/api/`
| エンドポイント | メソッド | 処理 |
|---|---|---|
| `/api/status` | GET | 今日のチェックイン一覧（人数 + 名前配列） |
| `/api/checkin` | POST | チェックイン |
| `/api/checkin` | DELETE | チェックアウト |
| `/api/announcements` | GET | お知らせ一覧（降順） |
| `/api/announcements` | POST | お知らせ投稿 + Discord 通知（fire-and-forget） |

### `src/components/`
| コンポーネント | 役割 |
|---|---|
| `StatusBoard` | 30秒ポーリングで参加者数・名前を更新表示 |
| `CheckinForm` | Discord 名入力 + チェックイン/アウトボタン |
| `AnnouncementForm` | 一言投稿フォーム + お知らせ一覧表示 |
| `MainPage` | 3コンポーネントと静的な開催情報を統合 |

---

## バグ修正（self-review HIGH 所見対応）

1. **JST 日付バグ** (`db.ts`): `toLocaleString` ベースの実装をホスト TZ 非依存の `Intl.DateTimeFormat` に変更
2. **Discord 失敗時の巻き添え** (`announcements/route.ts`): `await sendAnnouncement(...)` を fire-and-forget (`void ... .catch(...)`) に変更し、DB 保存済みのお知らせが Discord 障害で API エラーにならないよう修正
3. **メンション注入** (`discord.ts`): `allowed_mentions: { parse: [] }` を追加

---

## インフラ修正

`packs/languages/*/verify.sh` の `((PASS++))` が `set -euo pipefail` 環境でゼロ評価時に exit 1 を返すバグを全言語分修正（`PASS=$((PASS + 1))` に変更）。

---

## テスト

Vitest 44 ケース全通過。カバレッジ対象：
- `db.ts`: CRUD 全関数・JST ロールオーバーエッジケース
- `discord.ts`: 未設定時の no-op・正常送信
- 全 API ルート: 正常系・バリデーション異常系・特殊文字・冪等性
