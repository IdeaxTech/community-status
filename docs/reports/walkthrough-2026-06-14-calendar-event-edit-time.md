# PR ウォークスルー — feat/calendar-event-edit-time

**PR**: https://github.com/IdeaxTech/community-status/pull/4  
**日付**: 2026-06-14

---

## 変更の全体像

3 スライス構成:

1. **DB + API** — `time` カラム追加、PUT/DELETE エンドポイント追加
2. **UI** — CalendarView に時間入力・インライン編集フォーム・削除ボタン
3. **テスト修正** — 削除されていた既存テストを復元 + 新テスト追加 + TIME_RE 強化

---

## ファイル別ガイド

### `src/lib/db.ts`

- `CREATE TABLE calendar_events` の定義に `time TEXT` を追加
- 起動時に `ALTER TABLE calendar_events ADD COLUMN time TEXT` を try-catch で冪等適用
- `getCalendarEvents()`: SELECT に `time` を追加、`ORDER BY date ASC, time ASC, id ASC` で時刻順ソート（NULL は先頭）
- `addCalendarEvent(date, title, time?)`: `time` 引数を追加（省略時は `null`）
- `updateCalendarEvent(id, title, time)`: 新規追加。`changes > 0` で存在確認し boolean を返す
- `deleteCalendarEvent(id)`: 新規追加。同様に boolean を返す

### `src/app/api/calendar/route.ts`

- `TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/` — 時・分の範囲まで検証（`25:00` / `00:99` を弾く）
- `parseTime(v)`: `unknown → string | null` の変換ヘルパー
- `isValidTime(v)`: `null` または `TIME_RE` にマッチする場合のみ true
- `POST`: body に `time?` を追加、バリデーション後 `addCalendarEvent` に渡す
- `PUT`: `{ id, title, time? }` を受け取り `updateCalendarEvent`。id が非正整数なら 400、存在しなければ 404
- `DELETE`: `{ id }` を受け取り `deleteCalendarEvent`。同様の id バリデーション

### `src/components/CalendarView.tsx`

- `CalendarEvent` 型に `time: string | null` を追加
- `formatEvent(e)`: `time` があれば `"HH:MM タイトル"` 形式、なければタイトルのみ
- 状態追加: `addTitle`/`addTime`/`addError` (追加フォーム)、`editing`/`editError`/`editSubmitting` (編集フォーム)
- `openAdding(dateStr)`: 編集フォームを閉じてから追加フォームを開く（排他制御）
- `openEditing(e, ev)`: 追加フォームを閉じてから編集フォームを開く（`ev.stopPropagation()` でセルクリックと分離）
- `handleAdd`: POST → `loadEvents`
- `handleSave`: PUT → `loadEvents`
- `handleDelete`: DELETE → `loadEvents`
- セル内レンダリング: 既存イベントをクリックで編集フォーム、日付セルクリックで追加フォームを切り替え

### `src/app/api/calendar/route.test.ts`

- 旧テスト（trim、whitespace-only title、非閏年 Feb29、範囲外日付、UTF-8 保存など）を全復元
- 新テスト追加: GET での `time` フィールド確認、同日内時刻ソート、PUT の全バリエーション、DELETE の全バリエーション
- 総テスト数: 55（calendar route のみ）、全スイート 105 テスト

---

## テスト結果

- tsc: PASS
- Vitest: 105/105 PASS（6 ファイル）
- self-review: CRITICAL なし、HIGH 2 件（削除テスト復元・TIME_RE 強化）修正済み
