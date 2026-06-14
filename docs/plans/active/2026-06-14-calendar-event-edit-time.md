# プラン: カレンダー UX 改善 — 時間指定・編集・削除

**Date**: 2026-06-14  
**Type**: feat  
**Branch**: `feat/calendar-event-edit-time`  
**Related issue**: N/A

---

## 目的

カレンダーのイベント追加 UX に 2 つの欠陥がある：

1. 時間を指定できない — タイトルに混ぜるしかなく書式が統一されない
2. 追加後に内容を変えられない — 誤入力しても削除すら不可

「追加 → 閲覧 → 編集 → 削除」の一連の操作をカレンダーセル上でインラインに完結させる。

---

## スコープと非ゴール

**スコープ**:
- `calendar_events` テーブルに `time TEXT` カラムを追加（nullable、任意入力）
- `/api/calendar` に `PUT`（タイトル/時間の更新）と `DELETE`（個別削除）を追加
- `CalendarView` の追加フォームに時間入力（HH:MM、任意）を追加
- 既存イベントをクリックしてインライン編集フォームを開く
- 編集フォームに「削除」ボタンを追加

**非ゴール**:
- 認証・権限管理（設計方針: 認証不要）
- 終了時間・繰り返しルール
- ドラッグ&ドロップによる日付変更
- イベントの色分け
- 削除確認ダイアログ（ユースケース上不要）

---

## 前提

- `@libsql/client`（Turso/libSQL、`TURSO_DATABASE_URL` 未設定時は `file:./data.db` フォールバック）
- カレンダー UI は `CalendarView.tsx` のみ
- `id` は既にフロントに届いているので PUT/DELETE は id ベースで可能

---

## 影響ファイル・システム

| ファイル | 変更種別 |
|---------|---------|
| `src/lib/db.ts` | `time` カラム追加・マイグレーション、`updateCalendarEvent` / `deleteCalendarEvent` 追加 |
| `src/app/api/calendar/route.ts` | `PUT` / `DELETE` ハンドラー追加、`POST` に `time` 追加 |
| `src/components/CalendarView.tsx` | 時間入力・編集フォーム・削除ボタン |
| `src/app/api/calendar/route.test.ts` | PUT / DELETE のテスト追加、time フィールドのテスト追加 |

---

## 受け入れ基準

- [ ] イベント追加時に時間（HH:MM）をオプションで入力できる
- [ ] 時間が入力された場合、セル内で `HH:MM タイトル` 形式で先頭に表示される
- [ ] 既存イベントをクリックするとインライン編集フォームが開く
- [ ] 編集フォームでタイトルと時間を変更して保存できる
- [ ] 編集フォームに「削除」ボタンがあり即削除できる
- [ ] 追加・編集・削除後にカレンダーが自動更新される
- [ ] 空タイトルでの保存はクライアント + サーバー両方で拒否される
- [ ] 時間フォーマットが不正（`HH:MM` 以外）の場合はサーバーが 400 を返す
- [ ] tsc エラーなし、既存テスト全通過

---

## 設計決定

**時間の保持方法**: `time TEXT`（`HH:MM` 文字列、nullable）を別カラムで持つ。
- タイトルに埋め込むと書式が統一されず検索・ソートも不可
- `datetime` 型で持つと date との二重管理になる
- `HH:MM` 文字列なら表示がそのまま使えてシンプル

**編集 UI の場所**: セル内インライン（モーダルなし）
- モバイルでモーダルはタップ操作と干渉しやすい
- セルは既に垂直方向に柔軟に伸びる設計

**削除の確認ダイアログ**: なし
- 自分で追加したものを消すユースケースではオーバーヘッド
- 誤削除しても再追加が簡単

---

## 実装概要

### スライス 1 — DB + API

`src/lib/db.ts`:
- `getCalendarEvents()` の戻り値型に `time: string | null` を追加
- `addCalendarEvent(date, title, time?)` に `time` 引数を追加
- `updateCalendarEvent(id, title, time)` を追加
- `deleteCalendarEvent(id)` を追加
- `ALTER TABLE calendar_events ADD COLUMN time TEXT` を try-catch で冪等適用

`src/app/api/calendar/route.ts`:
- `POST` の body に `time?` を追加（バリデーション: `/^\d{2}:\d{2}$/` または null/未指定）
- `PUT` ハンドラー: `{ id, title, time? }` を受け取り更新、id が不正なら 404
- `DELETE` ハンドラー: `{ id }` を受け取り削除、id が不正なら 404

### スライス 2 — UI

`src/components/CalendarView.tsx`:
- `CalendarEvent` 型に `time: string | null` を追加
- 追加フォームに `<input type="time" />` を追加（任意）
- 既存イベント表示: `time` があれば `HH:MM タイトル` 形式で表示
- `editing: { id: number; title: string; time: string } | null` 状態を追加
- 既存イベントクリックで `editing` をセットして編集フォームを開く
- 編集フォーム: タイトル入力 + 時間入力 + 「保存」ボタン + 「削除」ボタン

---

## ベリファイプラン

- `./scripts/run-verify.sh` → tsc PASS
- PUT/DELETE が存在しない `id` を渡したとき 404 を返す
- `time` が `HH:MM` 以外のとき POST/PUT が 400 を返す
- ドキュメントドリフト: README の `/api/calendar` 説明を更新

---

## テストプラン

`src/app/api/calendar/route.test.ts` に追加:
- `GET` — レスポンスに `time` フィールドが含まれる
- `POST` — `time` あり/なしの両方で正常動作
- `POST` — 不正 `time` フォーマットで 400
- `PUT` — タイトル変更・時間追加・不正 id → 404・不正 time → 400
- `DELETE` — 正常削除・不正 id → 404

---

## リスクレジスター

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| 既存 DB に `time` カラムがない | 起動クラッシュ | 高（必ず発生） | `ALTER TABLE` を try-catch で冪等適用 |
| セルが狭いと編集 UI が潰れる | 視認性低下 | 中 | `overflow-hidden` + セルの min-h を増やす |
| `type="time"` の browser compat | 入力不可 | 低（主要ブラウザは対応済み） | 問題なし |

---

## ロールアウト・ロールバック

- ロールアウト: 通常の PR マージ
- ロールバック: `time` カラムは nullable なので旧コードもクラッシュしない。API の PUT/DELETE は追加のみなので既存クライアントに影響なし

---

## 進捗チェックリスト

- [x] スライス 1: DB + API（db.ts / route.ts）
- [x] スライス 2: UI（CalendarView.tsx）
- [x] テスト更新（route.test.ts）
- [x] `./scripts/run-verify.sh` PASS
- [ ] self-review 完了
- [ ] verify 完了
- [ ] test 完了
- [ ] sync-docs 完了
- [ ] PR 作成済み
