# 自己レビューレポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-11-calendar.md
**Diff**: `git diff HEAD~2..HEAD` on branch `feat/calendar` (commits `0270bf5`, `ecdb605`)

## サマリー

カレンダー機能の追加 (205 insertions / 0 deletions / 4 files) は、既存リポジトリの規約 (Next.js App Router の `route.ts` パターン、better-sqlite3 の同期 API、`as` を最小限に抑えた `unknown` プロパティの型ガード、`AnnouncementForm` のフェッチパターン) に沿っており、新たな依存も導入されていない。CRITICAL な所見はなし。日付バリデーションが正規表現のみで暦上の妥当性まで保証していない点と、フェッチ失敗時のユーザーフィードバック不在が主な改善余地。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | MEDIUM | 入力検証 | src/app/api/calendar/route.ts:21 | `^\d{4}-\d{2}-\d{2}$` は `2026-02-31` や `2026-13-01` を許容する。実在しない暦日が DB に書き込まれ、`getCalendarEvents` の `LIKE '2026-13-%'` クエリには絶対にヒットしないゴーストレコードが残る。少なくとも `new Date(date)` で再構築して同一文字列に戻ることを確認するべき。 |
| 2 | MEDIUM | 例外処理 | src/app/api/calendar/route.ts:15 | `await req.json()` が不正 JSON で投げる例外が捕捉されておらず Next.js のデフォルト 500 が返る。既存の `announcements/route.ts` と `checkin/route.ts` も同じ振る舞いだが、新規エンドポイントで踏襲する設計選択であれば最低でも巨大ペイロード制御を含めて意図を明示するか、共通ラッパーを導入したい (技術的負債候補)。 |
| 3 | MEDIUM | UX / エラーハンドリング | src/components/CalendarView.tsx:46-50, 66-77 | `loadEvents` / `handleAddEvent` が `fetch` の 4xx/5xx も例外も全くハンドルしない。サーバー側で 400 (`title` 空、不正な `date`) を返してもクライアントは無言で `setSubmitting(false)` し追加成功と同じ UI フローを辿る。受け入れ基準にあるサーバー側バリデーション (400 応答) がユーザー側で観測されない。`AnnouncementForm` も同じ欠点だが、追加・閲覧のフローが片方向な announcements と異なり、本機能は入力可能な日付セルが多く、フィードバック欠落の影響が大きい。 |
| 4 | LOW | 入力検証 | src/app/api/calendar/route.ts:8 | `year` の上限/下限チェックがなく、`year=99999999` のような値でも `LIKE '99999999-06-%'` クエリが流れる。SQL インジェクションのリスクはバインドパラメータで遮断されているが、month 同様 `year >= 1970 && year <= 2100` 程度の柵を入れたほうが防御深層の観点で素直。 |
| 5 | LOW | 仕様逸脱の可能性 | src/app/api/calendar/route.ts:17 | サーバー側で `title.trim().slice(0, 100)` と暗黙に切り詰めている。プラン (リスクレジスタ) で「title 文字数上限 100 文字」と決まっているため動作自体は仕様通りだが、ユーザーには切り詰められたことが伝わらない (101 文字でも 200 OK)。`> 100` で 400 を返すほうが API として明示的。 |
| 6 | LOW | 命名・可読性 | src/components/CalendarView.tsx:18 | 木曜の判定に魔法数 `4` を直書き。同ファイル内の `DAY_NAMES` 配列のインデックスとも対応していないため (DAY_NAMES は日曜始まり)、`const THURSDAY = 4 as const` のような名前付き定数のほうが grep しやすく意図が伝わる。 |
| 7 | LOW | 可読性 | src/components/CalendarView.tsx:116, 132 | `onClick`・`onKeyDown` のインラインアロー内で複数の `set*` 呼び出しを 1 行に詰めており可読性が落ちる。JSX をいじる際に diff も大きくなる。複数ステートメントは block 化するか、`handleCellClick(dateStr)` / `handleInputKey(e, dateStr)` を component スコープに切り出すと保守性が向上する。 |
| 8 | LOW | React 慣習 | src/components/CalendarView.tsx:123 | `dayEvents.map((title, j) => <p key={j} ...>)` でインデックス key を使用。現状は月切替で全件再フェッチするので問題ないが、将来削除機能が追加されると順序ずれによる再マウントバグの温床となる。`event.id` を保持する形に整形すれば回避できる。 |
| 9 | INFO | アクセシビリティ | src/components/CalendarView.tsx:113-117 | 日付セル全体に `onClick` が付いているが `<div>` で `role="button"` / `tabIndex` / `aria-label` がない。キーボード操作・スクリーンリーダーから「クリック可能」と認識されない。`/self-review` のスコープ外と判断するが、フォローアップ価値あり。 |
| 10 | INFO | 一貫性 | src/lib/db.ts:88-98 | 既存 `getAnnouncements` 等と同じく戻り値型を `as { ... }[]` で確定しているが、定義が直前のインターフェース型 (CalendarView 側の `CalendarEvent`) と二重管理になっている。共有 `types.ts` を作るほどではないが、将来は重複しがち。INFO として記録。 |
| 11 | INFO | 一貫性 | src/components/CalendarView.tsx:52-54 | `useEffect(() => { void loadEvents(year, month); }, [year, month])` で `loadEvents` を依存配列から外す既存パターンを踏襲。eslint `react-hooks/exhaustive-deps` がプロジェクトで有効化されていればこのファイルで初めて当該警告が増える可能性がある。`/verify` で確認するべき領域。 |

## ブロッキングな問題

なし。CRITICAL / HIGH 該当の所見はない。

## フォローアップ提案

- 所見 1 (暦日妥当性): `route.ts` の `POST` で正規表現通過後に `Date.parse` 経由のラウンドトリップ検証を追加することを推奨。サーバー側で弾けば未到達データの発生を根絶できる。
- 所見 3 (フェッチエラーハンドリング): `CalendarView` / `AnnouncementForm` の共通課題として `docs/tech-debt/` に「クライアント側 fetch のエラー表示パターン未整備」を追記候補 (announcements を含むため横展開が必要)。
- 所見 5 / 6 / 7: PR 内で軽微修正の範囲。差分が小さいので同じスライスで対応可能。
- 所見 9 (アクセシビリティ): 別フェーズで対応。今回はスコープ外。

## 確認済み項目

- [x] 不要な変更 — `MainPage.tsx` の 2 行追加のみ、無関係なフォーマット変更なし
- [x] 命名の一貫性 — `getX` / `addX` の DB API、`CalendarView` の Pascal、`route.ts` の `GET`/`POST` 命名は既存と整合 (所見 6 を除く)
- [x] 可読性 — 関数は 30 行未満、ネスト浅め。所見 7 のみ要改善
- [x] タイポ・コピペミス — 検出なし
- [x] null 安全性 — `searchParams.get` → `Number` → 真偽チェック、`eventsByDate[date] ?? []`、`adding` の `string \| null` ハンドリングいずれも問題なし
- [x] デバッグコード — `console.*`、`debugger`、コメントアウトコード、`TODO` なし
- [x] シークレット・認証情報 — ハードコードされた値なし。DB パスは `process.env.DB_PATH` 経由
- [x] 例外処理 — 所見 2 / 3 の通り、入力境界での try/catch が薄いが既存 API と同水準
- [x] セキュリティ — SQL はバインドパラメータ、React の自動エスケープによる XSS 防止、CSRF は既存方針 (認証なし要件) に沿う。新たなセキュリティ後退なし
- [x] 保守性 — 共有契約 (`calendar_events` テーブル / `/api/calendar` 契約) の変更は伴わない新規追加。マジックナンバー 1 件 (所見 6) のみ

## 判定

**修正後マージ**

理由: CRITICAL / HIGH の所見はなく、コードは既存リポジトリの規約・スタイルに整合する。ただし、所見 1 (暦日妥当性) と所見 3 (クライアントの fetch エラーフィードバック欠落) は MEDIUM レベルで、機能の正しさとユーザー体験に直接影響する。受け入れ基準「title が空・date が不正の場合は 400 を返す」がサーバー側では実装されているがクライアントが観測しないため、最低でも所見 3 への小さな対応 (アラート表示か追加ボタンの状態遷移) と所見 1 のラウンドトリップ検証を追加した上でマージすることを推奨する。
