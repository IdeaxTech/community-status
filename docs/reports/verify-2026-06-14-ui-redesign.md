# 検証レポート

**Date**: 2026-06-14
**Plan**: [docs/plans/active/2026-06-14-ui-redesign.md](../plans/active/2026-06-14-ui-redesign.md)
**Branch**: feat/ui-redesign
**Static verify log**: [docs/evidence/verify-2026-06-14-015123.log](../evidence/verify-2026-06-14-015123.log)

## 対象範囲

`feat/ui-redesign` ブランチ全体（`main..HEAD`）＋ステージ前の作業ツリー変更。具体的には：

- 新規コンポーネント: `src/components/HeroCard.tsx`, `src/components/Toaster.tsx`, `src/hooks/useToast.ts`
- 新規 / 変更 API・DB: `src/app/api/status/route.ts`（`attendees` フィールド追加）, `src/app/api/checkin/route.ts`（`status` 型ガード）, `src/lib/db.ts`（`status` カラム + マイグレーション + `CheckinStatus` 型）
- スタイル: `src/app/globals.css`（CSS 変数化 + ダークモード）, `tailwind.config.ts`（`darkMode: "media"`・`fade-up`・`pulse-slow` アニメーション追加）
- 削除（自己レビュー fix で対応済み）: `src/components/StatusBoard.tsx`, `src/components/CheckinForm.tsx`
- フォント: `next/font/google` の `Inter` に切り替え（`src/app/layout.tsx`）

## スペック適合性

### 重要な制約

プラン `docs/plans/active/2026-06-14-ui-redesign.md` は **テンプレートのまま** で、目的・スコープ・受け入れ基準・影響ファイル・テストプラン・リスクが空欄。したがって本検証は以下を代替の判定基準として用いた：

1. `requirements.md` の機能要件
2. 自己レビューレポート（`docs/reports/self-review-2026-06-14-ui-redesign.md`）の HIGH 4 件の修正状況
3. `.claude/rules/typescript.md`・`.claude/rules/golang.md` 等のリポジトリ品質ルール
4. 実装された差分が要件と整合しているか

| 受け入れ基準（代替） | ステータス | エビデンス |
|---------------------|-----------|-----------|
| AC-1: 参加者数と参加者の Discord 名一覧が表示される（requirements.md L20） | ✓ 満たされている | `HeroCard.tsx:222-233` で `data.attendees` を一覧表示 |
| AC-2: チェックイン / チェックアウトができる（requirements.md L29-30） | ✓ 満たされている | `HeroCard.handleCheckin`/`handleCheckout`（行 151-188）が `/api/checkin` POST/DELETE を呼ぶ |
| AC-3: 日付変わりで自動リセット（requirements.md L32） | ✓ 満たされている（既存挙動を維持） | `db.ts:73-74` で `DELETE FROM checkins WHERE date != today` を `getCheckins` 内で実行 |
| AC-4: 会場状況お知らせ投稿 + 一覧表示（requirements.md L22-24） | ✓ 満たされている | `AnnouncementForm.tsx` が POST/GET `/api/announcements` を呼ぶ |
| AC-5: 自己レビュー HIGH#1 — `globals.css` の外部フォント `@import` を `next/font` に置換 | ✓ 満たされている | `layout.tsx:2,5,20` で `Inter` を `next/font/google` 経由でロード。`globals.css` に `@import url(...)` は無し |
| AC-6: 自己レビュー HIGH#2 — デッドコード `StatusBoard.tsx` / `CheckinForm.tsx` を削除 | ✓ 満たされている | `git ls-files \| grep StatusBoard/CheckinForm` は空。`fa5afe0` で削除確認 |
| AC-7: 自己レビュー HIGH#3 — `MainPage.reloadRef` が dead state である問題 | ✓ 満たされている | `MainPage.tsx:9-30` から `reloadRef` 自体が削除されている。`HeroCard` の `onReloadRef` プロップは optional として残るがコール側は使わない |
| AC-8: 自己レビュー HIGH#4 — checkin route の `as CheckinStatus` キャストを型ガードに置換 | ✓ 満たされている | `src/app/api/checkin/route.ts:6-8` に `function isCheckinStatus(v: unknown): v is CheckinStatus` を実装。L16 で型ガード呼び出し |
| AC-9: 新機能 — チェックインに `at_venue` / `on_the_way` の状態を持たせる | ✓ 満たされている | `db.ts:70` で `CheckinStatus` 型定義。`addCheckin` 第2引数で受け取り、`/api/status` が `attendees: [{name, status}]` を返す |
| AC-10: 後方互換性 — `/api/status` の `names` フィールドを維持 | ✓ 満たされている | `route.ts:9` で `names` を継続返却。コメント `// Keep backward-compat field` あり |
| AC-11: スキーマ後方互換 — 既存 DB にも `status` カラムを追加 | ⚠ 部分的（実装方針に懸念） | `db.ts:38-43` の `ALTER TABLE ... catch {}` は「列が既に存在する」以外の例外も無言で握りつぶす（自己レビュー #6）。動作は意図通りだが、I/O 失敗・ロック・別構文エラーが見えなくなる |

### プランの欠陥

プラン本体（`docs/plans/active/2026-06-14-ui-redesign.md`）が **テンプレートのまま** であることはそれ自体が `.claude/rules/planning.md` の「プランは目的・スコープ・非ゴール・受け入れ基準・ベリファイプラン・テストプラン・リスク・エビデンスを定義すること」に違反する。受け入れ基準が定義されていないため、本検証の AC は実装と要件から逆算した代替であり、**プランの受け入れ基準と一致するとは保証できない**。これは `/pr` 前に解消すべき構造的ギャップ。

## ドキュメントドリフト

| 項目 | 状態 | 詳細 |
|------|------|------|
| README.md ディレクトリ構成 | ✗ ドリフトあり | `README.md:48-49` が削除済みの `StatusBoard.tsx`・`CheckinForm.tsx` を記載。新規 `HeroCard.tsx`・`Toaster.tsx`・`src/hooks/useToast.ts` の記載が無い |
| README.md `/api/status` の説明 | ✗ ドリフトあり | `README.md:42` は "GET 参加者数・名前一覧" のままで、追加された `attendees: [{name, status}]` フィールドに言及していない |
| README.md チェックイン機能 | ✗ ドリフトあり | "Discord 名の自己申告によるチェックイン / チェックアウト" のみで `at_venue`（在席中）/`on_the_way`（向かっています）の 2 状態追加が説明されていない |
| requirements.md | ⚠ 仕様の拡張あり | チェックインに状態（`at_venue`/`on_the_way`）が追加されたが `requirements.md:27-32` には反映無し。要件追加の意思決定がトレース不能 |
| CLAUDE.md / `.claude/rules/*` | ✓ 影響なし | UI リデザインで CLAUDE.md やルールが影響を受ける変更は無い |
| プラン（`docs/plans/active/2026-06-14-ui-redesign.md`） | ✗ 未記入 | テンプレートのまま。進捗チェックリストもチェック無し |
| `.env.local.example` / DB スキーマドキュメント | ⚠ スキーマ変更未文書化 | `checkins.status TEXT NOT NULL DEFAULT 'at_venue'` カラム追加と暗黙の `ALTER TABLE` マイグレーションが README "データベース" 節 (`README.md:91-95`) に未反映 |
| 自己レビュー所見との整合 | ✓ HIGH 4 件は対応済み | `fa5afe0: fix: address self-review HIGH findings — type guard, next/font, dead code removal` で #1〜#4 を解消（コード差分で確認） |

## 静的解析

```
./scripts/run-static-verify.sh
# Verification run
- Timestamp: 2026-06-14T01:51:23Z

==> Language packs detected: typescript
==> Running typescript verifier
=== TypeScript 検証 ===

--- 型チェック (tsc) ---
  [PASS] 型チェック

--- Lint (eslint) ---
  [SKIP] eslint が見つからない

--- フォーマット (prettier) ---
  [SKIP] prettier が見つからない

=== 結果: PASS=1  FAIL=0  SKIP=2 ===

==> すべてのベリファイアがパスしました。

Evidence saved to: docs/evidence/verify-2026-06-14-015123.log
```

**静的解析判定**: pass（tsc 完走）。ただし eslint・prettier 未インストールにより 2 SKIP — これは決定論的なベリファイア欠落としてカバレッジギャップ。

### 静的解析の限界 — 検出できなかったが懸念のある事項

tsc は型エラーは検出するが、以下は型レベルで合法のため pass する：
- 既存テスト `src/app/api/status/route.test.ts:24,34` が `count` と `names` のみ参照する古い契約のまま。型としては JSON は `unknown` 等価で扱えるためコンパイルは通るが、**振る舞いテストでは確実に fail する**（`toEqual({ count: 0, names: [] })` は新スキーマ `{ count, attendees, names }` と不一致）。`/verify` 範囲外（`/test` の責務）だが、ここで明示しておく。
- `globals.css` の `* { border-color: var(--border) }`（自己レビュー #5）は静的解析ではキャッチ不能。
- `useToast.ts:15` の `id = Date.now()` 衝突（自己レビュー #11）も型は問題なし。
- `tailwind.config.ts:17` の `pulse-slow` は Tailwind default の `pulse` keyframes に暗黙依存（自己レビュー #15）— 静的解析対象外。

## 残っているギャップ

### 検証済み・明確

- AC-1 〜 AC-10（前述）
- 自己レビュー HIGH#1〜#4 が `fa5afe0` で対応されたこと（diff で確認）
- 型チェック（tsc --noEmit）完走
- デッドコード `StatusBoard.tsx` / `CheckinForm.tsx` がリポジトリから消失

### おそらく正しいが未検証

- 新規 `HeroCard.tsx` の `getSessionState()`（行 28）が `new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))` を使う（自己レビュー #7 で指摘済み・未対応）。`db.ts:48` の `Intl.DateTimeFormat.formatToParts` ベースの安全版と異なるため、ロケール/ブラウザ依存でずれる可能性が残存。決定論的なユニットテストが無いので未検証。
- `globals.css` の `* { border-color: var(--border) }` がフォーム要素・SVG・iframe の既定スタイルを破壊しないか — 視覚回帰テストが無いので未検証。
- `Toaster.tsx` の `animate-fade-up` が `tailwind.config.ts` の `fade-up` キーフレーム経由でユーティリティとして生成されるか — Tailwind ビルド成果物の検査無し（型レベルでは検出不能）。
- 暗黙 `ALTER TABLE` マイグレーション（`db.ts:39-43`）が「列が既に存在する」以外のエラーを握りつぶす（自己レビュー #6・未対応）。本番 DB で I/O・ロック失敗が起きた場合に静かに失敗する。

### 未検証（決定論的チェックが欠落）

- **ESLint**: 未インストール。`.claude/rules/typescript.md` の "`any` を使わない" や "明示的な戻り値型" などの規律が機械的に強制できない。
- **Prettier**: 未インストール。フォーマット規律無し。自己レビュー #16 が指摘した formatting-only diff の検出も不能。
- **Lint for unused exports**: `AnnouncementForm.tsx:11` の `onPost?` プロップは呼び出し側で使われない（自己レビュー #9・未対応）。`ts-prune` や `knip` のような未使用エクスポート検出が無いので未検出のまま残る。
- **CSS lint**: Tailwind の `dark:` バリアントを `darkMode: "media"` で使う際の意図不明な重複クラス（自己レビュー #10 の Skeleton の `bg-slate-700/50 dark:bg-slate-700/50 bg-slate-200`）を静的に検知できる stylelint 等が未導入。
- **API contract drift detector**: `route.ts` の戻り値スキーマと `route.test.ts` の期待値の乖離を捕捉する仕組みが無い（型エクスポートして両者で共有していないため tsc は気づかない）。

### 最も信頼性を高める最小限のチェック（推奨）

1. **`npm i -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser` + 最小設定** — `.claude/rules/typescript.md` の `any` 禁止・明示的戻り値型・未使用変数禁止を強制。`packs/languages/typescript/verify.sh` がすでに eslint 起動を備えているので追加コストは設定のみ。
2. **`npm i -D prettier` + `.prettierrc`** — formatting-only diff を排除（自己レビュー #16）。`verify.sh` がすでに prettier --check を呼ぶ。
3. **`npm i -D knip`** または `ts-prune` を CI ステップに追加 — `AnnouncementForm.onPost` のような呼ばれないエクスポートを検出。
4. **API スキーマ共有**: `src/app/api/status/route.ts` の戻り値を `export interface StatusResponse` として共有し、`route.test.ts` が同じ型を import すれば、スキーマ変更時に古いテストの期待値が型エラーで検出される。**ゼロコストの構造的改善**。
5. **`requirements.md` と README の更新義務をプランテンプレートに組み込む** — `.claude/rules/planning.md` に「契約変更時は要件・README を同時更新する」と明文化する。

## 結論

**総合判定**: partial-pass

理由:
- 静的解析（tsc）はクリーンに通る — **pass**
- 実装は要件（requirements.md）と自己レビュー HIGH#1〜#4 の修正要求を満たす — **pass**
- しかし以下のドキュメントドリフトと構造的問題が残存し、`/pr` 直前の品質基準として無視できない：
  - **プラン本体がテンプレートのまま**（受け入れ基準・スコープ・テストプラン未記入）。`.claude/rules/planning.md` 違反。
  - **README.md にデッドリンク**（`StatusBoard.tsx`・`CheckinForm.tsx`）、新規コンポーネント未記載。
  - **`/api/status` の契約変更**（`attendees` 追加）が README に未反映。
  - **チェックイン状態（`at_venue`/`on_the_way`）の新機能**が `requirements.md` と README に未反映 → 要件トレーサビリティ断絶。
  - **DB スキーマ変更**（`status` カラム追加 + 暗黙マイグレーション）が README "データベース" 節に未反映。
  - **既存テスト `status/route.test.ts` の期待値が新契約と不一致** — 静的には通るが `/test` で確実に fail する（`/verify` 範囲外だが報告）。

修正必須（fail 相当の項目）:
- プランの受け入れ基準を埋める（または「テンプレート化されたままだが、self-review レポートを正準とする」と明示する）。
- README.md のディレクトリ構成・`/api/status` 説明・チェックイン機能・データベース節を更新する。
- `requirements.md` にチェックイン状態の機能要件を追記する。

修正後、`/sync-docs` フェーズで上記をまとめて反映できれば pass に転じる見込み。静的解析自体は健全。

### 次のステップ

1. プランと README・requirements.md のドリフト解消（`/sync-docs` の責務だが、契約変更を伴うため `/test` 前に着手しても良い）
2. `/test` を実行 — 既存 `status/route.test.ts` の fail を確認し、新契約に合わせた assertion 修正を実装に取り込む
3. eslint・prettier を導入してカバレッジギャップを埋める（フォローアップ Issue 化可）
