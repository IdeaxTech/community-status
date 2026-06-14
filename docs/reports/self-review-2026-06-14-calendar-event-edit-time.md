# 自己レビューレポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-14-calendar-event-edit-time.md
**Diff**: `37f33a8^..HEAD` on `feat/calendar-event-edit-time` (3 commits: 37f33a8, e551109, cb23267)

## サマリー

スコープに沿った機能追加（`time` カラム、PUT/DELETE、編集 UI）。バリデーション・null 安全性・型は健全で、シークレット混入やデバッグコード残置はない。一方、テストファイル `route.test.ts` は本機能と無関係に既存テストを大幅に削減しており、回帰カバレッジを失っている（HIGH）。また `time` バリデーションが構文のみで意味的に無効な値（`99:99` など）を許す点、`CalendarView` のセル onClick トグル分岐が読みにくい点が残課題。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | HIGH | 不要な変更 | src/app/api/calendar/route.test.ts | 本機能と無関係な既存テスト（trim、whitespace-only title、type 不正、Feb 29 非閏年、out-of-range month/day、UTF-8/HTML preservation、Thursday 境界、empty body、年/月の非数値）が一括削除されている。スコープ外の回帰カバレッジ削減。 |
| 2 | MEDIUM | セキュリティ/保守性 | src/app/api/calendar/route.ts:4 | `TIME_RE = /^\d{2}:\d{2}$/` は構文のみ検証。`99:99` `25:70` `00:99` 等の意味的に不正な値が DB に格納される。UI（`<input type="time">`）からは到達しないが API は公開エンドポイント。受け入れ基準「時間フォーマットが不正なら 400」の解釈次第。 |
| 3 | MEDIUM | 可読性 | src/components/CalendarView.tsx:234-238 | セルの onClick が `openAdding(isAdding ? "" : dateStr)` の後に `if (isAdding) setAdding(null)` という二段の状態更新。閉じる側でも `openAdding("")` が走り無関係なフィールドリセットが起きる。`if (isAdding) setAdding(null); else openAdding(dateStr);` に分けたほうが意図が直接読める。 |
| 4 | LOW | 保守性 | src/components/CalendarView.tsx:168-170 | `inputBase = ["w-full text-xs ..."].join(" ")` は単一要素配列の join で冗長。直接文字列を代入すれば足りる。 |
| 5 | LOW | 保守性 / UX | src/components/CalendarView.tsx:141-159 | `handleDelete` が `handleSave` と異なり開始時に `setEditError("")` を呼ばない。直前の保存エラーが残り、削除失敗まで古いエラーが表示され続けるエッジケース。 |
| 6 | LOW | 命名 | src/app/api/calendar/route.ts:6-9 | `parseTime` という名前だが実体は「型と空文字をハンドルして null/string に正規化」のみで「パース」してはいない。`normalizeTime` または `coerceTime` のほうが意図に近い。 |
| 7 | LOW | 不要な変更 | src/app/api/calendar/route.test.ts:5 | 既存の有用なコメント "NextRequest used by the GET handler — only `req.url` is accessed..." が削除されている。stub の意図を伝えるドキュメントだった。 |
| 8 | LOW | 不要な変更 | src/components/CalendarView.tsx:231 | 既存セル className の `cursor-pointer transition-colors duration-150` → `transition-colors duration-150 cursor-pointer` という単なる並び替え。本機能と無関係なフォーマット diff。 |
| 9 | INFO | 保守性 | src/app/api/calendar/route.ts:43 | `addCalendarEvent(date, title, time ?? undefined)` で `null → undefined` 変換。`addCalendarEvent` の引数を `string | null` に揃えれば変換が不要（db.ts 側は `time ?? null` で受け取っているため null 直渡しでも動く）。 |
| 10 | INFO | 保守性 | docs/plans/active/2026-06-14-calendar-event-edit-time.md:102-103 | プランは「id が不正なら 404」と書かれているが、実装は型/範囲不正は 400、存在しないだけ 404 と区別している（HTTP セマンティクス的に正しい）。プラン側のサイレントな改善なので明示しておきたい。 |

## ブロッキングな問題

CRITICAL なし。HIGH は #1（テストカバレッジの後退）。

### #1 詳細 — `route.test.ts` のスコープ外削減

3 番目のコミット `cb23267 test: add PUT/DELETE and time field tests for calendar route` は名前と裏腹に、PUT/DELETE/time テストの追加に加えて既存の POST/GET テスト群を大幅に圧縮・削除している。差分統計は `+317 / -493`。

削除された主なケース（リポジトリ契約として価値がある）：
- "trims surrounding whitespace from date before validating"
- "400 on whitespace-only title"
- "400 when title is missing" / "400 when title is the wrong type (number)"
- "400 on empty date" / "400 when date is missing"
- "400 when date is Feb 29 in a non-leap year (2025-02-29)"
- "400 when month is out of range (2026-13-01)"
- "400 when day is out of range (2026-04-31, April only has 30 days)"
- "accepts events on Thursdays at the start/end of a month"
- "rejects empty body cleanly (title check fires first)"
- "preserves special characters in title (UTF-8, quotes, HTML)"
- "400 when year/month is not numeric"

エビデンス：
- `git show 37f33a8:src/app/api/calendar/route.test.ts` に上記が存在
- 現在の `route.test.ts` には存在しない
- プラン §テストプランは「追加」のみを指示しており、既存テスト削除は明記されていない

スペック適合性は `/verify` 側、テストカバレッジ評価そのものは `/test` 側の責務だが、**スコープ外の削除**は diff 品質の問題として扱うべき。HIGH 扱いで、マージ前に削除されたケースを復元することを推奨。

注：`/self-review` は CRITICAL のみで停止するルールのため、HIGH の段階では止めず、修正後マージを推奨する判定で続行。

## フォローアップ提案

- #2: 時間の意味的バリデーション。`Number(hh) < 24 && Number(mm) < 60` を追加するか、`^([01]\d|2[0-3]):[0-5]\d$` 等の正規表現に置換。同じ修正で POST/PUT 両方をカバー可能。
- #3: セル onClick の早期 return を二段にして読みやすくする。
- #5: `handleDelete` 冒頭で `setEditError("")` を追加。
- #6: `parseTime` → `normalizeTime` にリネーム。
- #9: `addCalendarEvent` シグネチャを `time?: string | null` に揃え、route.ts 側の `time ?? undefined` を不要にする。
- 一般: テストの圧縮意図（カバレッジが冗長だった等）があるなら、本機能とは別 PR で実施し、削除理由をコミットメッセージに残すのが好ましい。

## 確認済み項目

- [x] 不要な変更（HIGH 所見 #1、LOW #7 #8 あり）
- [x] 命名の一貫性（LOW #6）
- [x] 可読性（MEDIUM #3）
- [x] タイポ・コピペミス（なし）
- [x] null 安全性（`time ?? null`、`e.time ?? ""` 妥当）
- [x] デバッグコード（なし）
- [x] シークレット・認証情報（なし）
- [x] 例外処理（fetch エラーは `setEditError` / `setAddError` で表示、API は早期 return で握りつぶしなし）
- [x] セキュリティ（SQL は prepared statement、time 文字列はフォーマット検証あり。バインドで SQLi なし。XSS は React のテキスト描画でエスケープ。CSRF は app 全体方針に依存）
- [x] 保守性（MEDIUM #3、LOW #4 #5 #9、INFO #9）

## 判定

**修正後マージ**

理由：機能・契約・型・null 安全性は健全で、UI 状態管理も動作する。ただし HIGH #1（既存テストのスコープ外削減）はマージ前に解消する必要がある。テスト削減を意図的に行う場合は別 PR で理由とともに記録するのが本リポジトリのテストルール（テストは振る舞いを文書化する／回帰テストは固定する）に整合する。MEDIUM #2, #3 は本 PR でついでに直すか、フォローアップとして残す判断は実装者に委ねる。
