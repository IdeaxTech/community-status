# ウォークスルー: calendar

**Date**: 2026-06-14
**Branch**: feat/calendar
**Base**: feat/community-status-app
**Diff**: 12 files changed, 1019 insertions

## 概要

月次カレンダー機能を追加。毎週木曜日のもくもく会を自動表示し、誰でも任意の日付にイベントを追加できる。

---

## 新規ファイル

### `src/app/api/calendar/route.ts`
- `GET /api/calendar?year=&month=` — year/month バリデーション後 SQLite からイベント取得
- `POST /api/calendar` — date（YYYY-MM-DD 形式 + 暦日妥当性チェック）と title（必須・100文字上限）でイベント追加

### `src/components/CalendarView.tsx`
- 月次グリッド（7列）、前月・次月ナビゲーション
- その月の木曜日を `Date.getDay() === 4` でクライアント側計算し「もくもく会 13:00〜20:00」を自動表示（DB 不使用）
- 日付セルをクリックするとインライン入力フォームが展開し、Enter or ボタンでイベント追加
- API エラー（400等）はセル内にメッセージ表示

---

## 変更ファイル

### `src/lib/db.ts`
- `calendar_events(id, date, title, created_at)` テーブルを `initSchema` に追加
- `getCalendarEvents(year, month)` — `date LIKE 'YYYY-MM-%'` でその月のイベントを日付・id 昇順で取得
- `addCalendarEvent(date, title)` — 挿入

### `src/components/MainPage.tsx`
- `<CalendarView />` を末尾に追加

---

## self-review HIGH 所見への対応

1. **暦日妥当性** (`route.ts`) — `new Date(date).toISOString().slice(0, 10) !== date` で `2026-02-31` 等を弾く
2. **API エラー伝搬** (`CalendarView.tsx`) — `res.ok` チェック後にエラーメッセージをセル内に表示

---

## テスト（85/85 pass）

カレンダー関連 37 ケース:
- `db.test.ts` — CRUD・ソート・月境界・うるう年・特殊文字
- `api/calendar/route.test.ts` — GET バリデーション・POST 正常系/異常系（空 title・不正 date・`2026-02-31`・非うるう年2/29）
