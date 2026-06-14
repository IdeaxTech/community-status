# 自己レビューレポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-14-ui-redesign.md
**Diff**: feat/ui-redesign（main..HEAD + ステージ前の変更）

対象範囲: ブランチ全体の UI リデザイン差分（HeroCard 新規追加、CheckinStatus 追加、ダークモード CSS 変数化、Toast 機構、関連 API/DB 変更）。スペック適合性・テスト合否・ドキュメントドリフトは評価対象外（それぞれ `/verify` と `/test` 担当）。

## サマリー

差分は UI 一新とチェックイン状態（at_venue / on_the_way）追加で機能性は明確だが、複数の品質課題が混在する。最も重い問題はサードパーティフォントの外部 `@import`、過度に広い `* { border-color }` 規則、`as CheckinStatus` キャストによる型安全性の侵食、旧コンポーネント（StatusBoard / CheckinForm）のデッドコード化、MainPage の `reloadRef` が宛先を失っていること。HIGH 1 件・MEDIUM 多数で「修正後マージ」を推奨する。CRITICAL は無し。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | HIGH | セキュリティ/パフォーマンス | src/app/globals.css:1 | Google Fonts を `@import url(...)` で外部読み込みしている。Next.js は `next/font` でセルフホスト + プリロード + CLS 最適化を提供しており、外部 `@import` はレンダリングブロッキングかつクライアント IP の Google への漏洩を生む。CSP を将来追加した際にも崩れる。 |
| 2 | HIGH | 保守性/デッドコード | src/components/StatusBoard.tsx, src/components/CheckinForm.tsx | MainPage が HeroCard に統合され、両コンポーネントは `src/` 内のいずれからも import されない（grep で確認）。残置するとレビュー・改修時に二重実装の罠を生む。削除するか、明示的に「廃止」コメントを付ける。 |
| 3 | HIGH | 保守性/デッドコード | src/components/MainPage.tsx:9, :21 | `useRef<(() => void) \| null>(null)` で `reloadRef` を作って HeroCard に渡しているが、AnnouncementForm にも CalendarView にも `reloadRef` を伝播していないため、外部からチェックイン状態の再読込を起動するパスが存在しない。旧アーキでは `CheckinForm.onUpdate -> reloadRef -> StatusBoard.load` だったが、新アーキでは HeroCard 内部の `setInterval(30s)` のみが残る。`reloadRef` を残すならどこから呼ぶか明示、不要なら削除。 |
| 4 | HIGH | セキュリティ/型安全性 | src/app/api/checkin/route.ts:12 | `VALID_STATUSES.includes(body.status as CheckinStatus)` の `as CheckinStatus` キャストは「unknown を信頼する」と等価。`Array.prototype.includes` は実行時には任意値で動くので問題ないが、型安全性の観点からは型ガード関数 (`function isCheckinStatus(s: unknown): s is CheckinStatus { return typeof s === "string" && (VALID_STATUSES as readonly string[]).includes(s); }`) を使うべき。これがあれば 2 度キャストする必要が無くなり、不正値 (`null`, `{}`, `42` 等) も明示的に「default に倒す」ことが読み取れる。今は「不正型もデフォルトに倒す」挙動が暗黙でレビュアーには見えない。 |
| 5 | MEDIUM | 保守性/CSS | src/app/globals.css:33-35 | `* { border-color: var(--border); }` はあらゆる要素にデフォルト border-color を当てるので、SVG・iframe・フォームコントロールの既定スタイルまで上書きする可能性がある。Tailwind v3 preflight はすでに `*, ::before, ::after { border-color: theme(...) }` を出しているため、ここで再定義する意義は薄い。`border-color` を上書きしたいなら `@layer base { *, ::before, ::after { ... } }` のように疑似要素も含めて preflight と同じ範囲に揃えるか、`.card` 等で局所化したほうが安全。 |
| 6 | MEDIUM | 例外処理/保守性 | src/lib/db.ts:38-43 | `try { ALTER TABLE checkins ADD COLUMN status ... } catch { /* no-op */ }` は「列が既に存在する」以外のエラー（DB ロック・I/O 失敗・別の SQL 構文エラー）も無言で握りつぶす。`catch (e)` で `String(e).includes("duplicate column name")` だけ no-op、それ以外は `throw` または `console.warn` するのが安全。better-sqlite3 のエラーメッセージは安定しているのでチェック可能。 |
| 7 | MEDIUM | 可読性/イディオム | src/components/HeroCard.tsx:28-48 | `new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))` は文字列を再パースする「JST 偽装」テクニックで、`toLocaleString` の出力形式がロケール/ブラウザに依存する点で壊れやすい。同リポの `src/lib/db.ts:48` ではすでに `Intl.DateTimeFormat(... timeZone: "Asia/Tokyo").formatToParts(...)` を使う安全版がある。同じパターンを HeroCard でも採用すべき（時/分が必要なら `hour`, `minute` パートを取得）。プロジェクトの過去コミット `7dfde61: fix: correct JST date calc` で同種バグを修正済みなので、再発と判定される可能性が高い。 |
| 8 | MEDIUM | 例外処理 | src/components/AnnouncementForm.tsx:24-39 | `handleSubmit` 内で `fetch` の戻り値 `res.ok` を確認せず、ネットワーク失敗 or 5xx でも `setContent("")` で入力を消し `onPost?.()` を呼び `loadAnnouncements()` する。投稿失敗を UI に出せず、ユーザは「投稿できた」と誤認する。`res.ok` チェック → 失敗時は input を残し toast でエラー表示が望ましい。HeroCard.handleCheckin / handleCheckout は同じパターンを正しくハンドリングしている（参考になる）。 |
| 9 | MEDIUM | デッドコード/不要な変更 | src/components/AnnouncementForm.tsx:11, :36 | `onPost?: () => void` プロップを追加したが、MainPage は `<AnnouncementForm />`（プロップ無し）で呼んでいる。呼び出し側で使われない API 拡張はデッドコード。意図があるなら MainPage 側で接続する、無いなら削除。 |
| 10 | MEDIUM | 可読性/CSS | src/components/HeroCard.tsx:99-105 | `Skeleton` 内で `bg-slate-700/50 dark:bg-slate-700/50 bg-slate-200` のように同一プロパティ（background-color）の utility を 3 つ並べている。`darkMode: "media"` 設定下では `dark:` バリアントは `@media (prefers-color-scheme: dark)` 内に出るので機能はする（カスケード順で後者の `bg-slate-200` がライト時に勝つ）が、レビュアーには意図が読み取れない。`bg-slate-200 dark:bg-slate-700/50` の 2 クラスに整理すべき。 |
| 11 | MEDIUM | 保守性 | src/hooks/useToast.ts:15 | `const id = Date.now();` は連続表示でミリ秒衝突する。`useToast` のクロージャ内で `let counter = 0; const id = ++counter;` または `crypto.randomUUID()` を使う。同時に複数 toast を出すフロー（HeroCard で check-in 成功と失敗が立て続けに来ても発生し得る）で React の key 重複 warning を引く。 |
| 12 | LOW | 命名 | src/components/HeroCard.tsx:110 | `LS_KEY = "mokumoku_discord_name"` は固定文字列だが、グローバルキーが他コンポーネントから参照される可能性を考えると `@/lib/storage-keys.ts` などに切り出すのが将来安全。今はファイルローカルで OK だが、もう一箇所で同キーを参照したくなる兆しが出たら昇格させる。 |
| 13 | LOW | 可読性 | src/components/HeroCard.tsx:190-194 | `isCheckedIn` の三項ネストが読みづらい。`const currentName = myName ?? savedName; const isCheckedIn = currentName ? data?.attendees.some(a => a.name === currentName) ?? false : false;` のように共通変数を取り出すと意図が明瞭になる。下の JSX でも同じ `myName ?? savedName` を再記述しており、一元化メリットがある。 |
| 14 | LOW | 可読性/style 混在 | src/components/HeroCard.tsx 多数, AnnouncementForm.tsx, CalendarView.tsx | Tailwind class と inline `style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}` が頻出。card / muted のように共通化できるものは globals.css の `@layer utilities` に `.input-themed`、`.btn-ghost` 等を追加して JSX を薄くしたい。現状でも動作するが、6 ファイルに同じ 3 行 style が散在し変更コストが高い。 |
| 15 | LOW | 保守性 | tailwind.config.ts:17 | `"pulse-slow": "pulse 2s ..."` は Tailwind デフォルトの `pulse` keyframes に依存する。`theme.extend.keyframes` は default を merge するので現状動くが、将来 `theme.keyframes`（extend 無し）に変えると壊れる暗黙依存。コメントで「Tailwind default の pulse keyframes を再利用」と明示すると安全。 |
| 16 | LOW | 不要な変更/フォーマット | src/components/CalendarView.tsx:58-65 | `(y => y - 1)` を `((y) => y - 1)` 等、関数の括弧スタイルだけ変更している diff が複数ある。typescript.md には括弧のスタイル指定は無く、prettier の設定にも依存する。本筋（CSS 変数化）以外の formatting-only diff が混じると変更レビュー負荷が上がる。 |
| 17 | INFO | API 互換 | src/app/api/status/route.ts:6-11 | `attendees` を追加しつつ `names` を残しているのは互換のため明示的で良い設計。コメント `// Keep backward-compat field` がそれを担保している。ただし `names` をいつ削除可能かの目印（TODO: 削除予定 / @deprecated）があるとさらに親切。 |

## ブロッキングな問題

CRITICAL は無いため自動停止はしない。ただし以下の HIGH 4 件は `/pr` 前にハンドリング推奨：

### #1 globals.css の外部フォント `@import`
`@import url('https://fonts.googleapis.com/css2?...')` は (a) クライアントの IP / User-Agent / Referer を Google に渡す、(b) レンダリングブロッキング、(c) 将来 CSP `style-src` を導入する際に違反、の三重課題。Next.js は `next/font/google` でビルド時にセルフホスト化できるので、`layout.tsx` で

```ts
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-inter" });
```

として `<body className={inter.variable}>` に切り替えるのが Next.js 標準。globals.css 側の `@import` と `body { font-family: Inter, ... }` も `var(--font-inter)` 経由に直す。

### #2 StatusBoard / CheckinForm デッドコード
`grep` で `src/` 内に import 元なしを確認済み。`src/app/page.tsx → MainPage → HeroCard` の構成に切り替わったため両者は完全に dead。残せばタイポ・命名修正の二重メンテを誘発する。`/work` のスコープが UI リデザインなら同 PR で削除して整合性を取るのが筋。テスト（もしあれば）は同時に削除。

### #3 MainPage.reloadRef が dead state
HeroCard の `onReloadRef` プロップは現状有効だが、`reloadRef` を呼び出すコードパスが MainPage / 子コンポーネントいずれにも存在しない。`AnnouncementForm.onPost` 等から実際に triggers するか、`reloadRef` ごと削除する。中途半端な状態は将来「なぜ動かないのか」の調査コストを生む。

### #4 checkin route の `as CheckinStatus` キャスト
実行時の安全性は確保されているが、型システム上は「unknown を信頼する」という宣言になっており、`VALID_STATUSES.includes(body.status as CheckinStatus)` という記述は不正値（`null`, `42`, `{}`）も「型としては CheckinStatus と仮定したが結果的に default に倒す」と読める。型ガードに置換すべき：

```ts
function isCheckinStatus(s: unknown): s is CheckinStatus {
  return typeof s === "string" && (VALID_STATUSES as readonly string[]).includes(s);
}
const status: CheckinStatus = isCheckinStatus(body.status) ? body.status : "at_venue";
```

これで `as` キャストが消え、`.claude/rules/typescript.md` の「`as` キャストは型ガードが型推論より正確な場合のみ使う」にも沿う。

## フォローアップ提案

MEDIUM 〜 LOW は次イテレーションで吸収可：

- #5 `* { border-color }` を Tailwind preflight に任せる、または局所化
- #6 ALTER TABLE の例外を「duplicate column name」のみ no-op
- #7 HeroCard の JST 計算を `Intl.DateTimeFormat` ベースに統一（過去同種バグの再発防止）
- #8 AnnouncementForm に `res.ok` ガードと失敗時 toast
- #9 `onPost` を本当に必要なら MainPage で接続、不要なら削除
- #10 Skeleton の `bg-*` 重複を整理
- #11 useToast の id を単調増加カウンタまたは UUID に
- #12 LS_KEY を `@/lib/storage-keys.ts` に切り出す（タイミングは 2 箇所目使用時）
- #13 isCheckedIn の三項ネスト解体
- #14 共通 style を `.input-themed`, `.btn-primary` 等にユーティリティ化
- #15 `pulse-slow` の default 依存をコメントで明示
- #16 prettier 設定で関数引数の括弧スタイルを固定し、フォーマットのみ diff を減らす
- #17 `names` フィールドに `@deprecated` コメントと削除予定日

技術的負債としては記録不要レベル（追加実装ですぐ解消可能）。

## 確認済み項目

- [x] 不要な変更（#16 フォーマットのみ diff を指摘）
- [x] 命名の一貫性（#12 LS_KEY 切り出しタイミング指摘、概ね一貫）
- [x] 可読性（#7 JST, #10 Skeleton, #13 isCheckedIn, #14 style 混在）
- [x] タイポ・コピペミス（無し）
- [x] null 安全性（#4 as キャスト、#13 三項チェーン）
- [x] デバッグコード（残置無し）
- [x] シークレット・認証情報（無し。`@/lib` の DB_PATH も既存ロジック）
- [x] 例外処理（#6 ALTER TABLE swallow、#8 fetch.ok 未確認）
- [x] セキュリティ（#1 外部フォント、#4 型ガード欠如）
- [x] 保守性（#2 デッドコード、#3 dead reloadRef、#9 dead prop、#11 toast id 衝突、#14 style 混在）

## 判定

**修正後マージ**

理由: CRITICAL は無いが、HIGH 4 件は単独 PR の品質基準として除去すべき。特に
1. 外部フォント `@import` はセキュリティ/パフォーマンス影響が永続的に残る
2. デッドコード（StatusBoard / CheckinForm + MainPage.reloadRef + AnnouncementForm.onPost）はリデザインスコープ内で同時に整理可能で、放置すると将来コストを増やす
3. `as CheckinStatus` キャストはリポジトリの typescript ルール（`.claude/rules/typescript.md`）に明確に違反

上記 4 件を修正したのち再度 `/self-review` を回してから `/verify`・`/test` に進むのが整合的。MEDIUM/LOW はフォローアップ Issue で吸収可。
