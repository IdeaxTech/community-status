# 自己レビューレポート

**Date**: 2026-06-14
**Plan**: docs/plans/active/2026-06-14-liquid-glass-ui.md
**Diff**: `fe9e0ec^..HEAD`（コミット `fe9e0ec` / `1ec0e82` / `dc2912d`、5 ファイル / +82 / -36）

## サマリー

Liquid Glass テーマへの刷新は CSS 変数の構造としてはきれいだが、`--bg` を削除した一方で `CalendarView.tsx` と `HeroCard.tsx` の 2 箇所で `var(--bg)` 参照が残り、視覚的リグレッションが発生している。さらに `AnnouncementForm` の li で inline `borderColor` が Tailwind の `border-orange-500/60` 左ボーダーカラーを上書きし、お知らせ項目のオレンジアクセントが消えている。アクティブセッションバッジは `className` と `style.animation` の両方でアニメーションを宣言しており冗長。マージ前に修正すべき HIGH 級の所見が複数ある。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | HIGH | 不要な変更 / リグレッション | src/components/CalendarView.tsx:217 | `--bg` 変数が `globals.css` から削除されたが、空セルの `background: var(--bg)` 参照が残存。CSS 変数が未定義なため背景は無効化され、親グリッドの `var(--border)` が透けて表示される。 |
| 2 | HIGH | 不要な変更 / リグレッション | src/components/HeroCard.tsx:289 | Discord 名入力欄が `background: var(--bg)` を使用しているが `--bg` は削除済み。入力欄の背景が透明化し、フロスト効果の上で視認性が低下する。`var(--glass)` に統一すべき。 |
| 3 | HIGH | 可読性 / リグレッション | src/components/AnnouncementForm.tsx:70-71 | `className` に `border-l-2 border-orange-500/60` を残したまま、inline `style.borderColor: var(--glass-border)` を追加。inline `borderColor` は 4 辺すべての色を上書きするため、左側オレンジアクセントが消失する。デザイン意図と矛盾。 |
| 4 | MEDIUM | 可読性 / 保守性 | src/components/HeroCard.tsx:55-61 | active バッジで `className="animate-glow-pulse"` と `style.animation: "iridescent ..., glowPulse ..."` を併用。inline `animation` shorthand が Tailwind 由来の animation を完全に上書きするため `animate-glow-pulse` クラスは dead code。`className` から削除するか、tailwind の `animate-[iridescent_4s_linear_infinite,glow-pulse_2s_ease-in-out_infinite]` 任意値構文に統一すべき。 |
| 5 | MEDIUM | アクセシビリティ | src/app/globals.css 全体 | プランのリスクレジスター（177 行）で `prefers-reduced-motion` 対応を「対策」として明記しているが、実装に `@media (prefers-reduced-motion: reduce)` ルールが存在しない。`iridescent` / `glowPulse` は無限ループのため、低刺激設定ユーザに影響あり。 |
| 6 | MEDIUM | 保守性 / 命名 | src/components/HeroCard.tsx:57 | active バッジの iridescent グラデーション色 (`#6366f1,#8b5cf6,#ec4899`) が CSS 変数ではなくマジック値として inline。tailwind config の `glowPulse` keyframe で使う色 (`rgba(99,102,241,0.4)` 等) と同じ虹色を再利用しており、`globals.css` の CSS 変数（例: `--iridescent-stops`）または tailwind 拡張カラーに集約した方が将来の調整がしやすい。 |
| 7 | LOW | 命名 / 可読性 | src/app/globals.css:7-29 | `--glass-high` / `--glass-border` / `--glass` の用途差が変数名から読み取りにくい。命名を `--glass-bg`、`--glass-bg-strong`、`--glass-border` のように一貫させると下流コードの選択ミスを減らせる。 |
| 8 | LOW | プランドリフト | src/app/layout.tsx | プラン（25 行 / 51 行）は body にグラデーション背景クラスを追加すると明記しているが、実際には `globals.css` の body セレクタで実装。結果は同じだが、プランとの突合せ時にドリフトとして見える。プランを更新するか、layout.tsx 経由実装に揃える。 |
| 9 | LOW | コード品質 | src/app/globals.css:33-39 | `background: linear-gradient(...)` だけで `background-color` のフォールバックがない。`backdrop-filter` 非対応ブラウザでカードの透明度が漏れた場合、グラデが認識されないと地が真っ白になる。`background-color: var(--bg-to)` を併記するとリスクが下がる（プランの risk register の対策と整合）。 |
| 10 | LOW | コード整合性 | src/components/HeroCard.tsx:72-78 | `upcoming` バッジに inline `backdropFilter: "blur(8px)"` を直書き。他の状態（ended / next）は `var(--glass)` だけで blur を持たないため、状態間で視覚的一貫性がない。意図的なら理由をコメントで残すべき。 |
| 11 | INFO | 命名 | tailwind.config.ts:18-20 | `"iridescent"` と `"glow-pulse"` の命名は良いが、`iridescent` は単独使用例が見当たらない（HeroCard は inline `animation` で両方を直接指定）。tailwind のアニメーションは現状用途が薄い。 |

## ブロッキングな問題

### 所見 #1 / #2: `--bg` 変数の参照漏れ

`globals.css` 差分で `--bg: #f8fafc` / `#0a0f1e` を削除し、`--bg-from` / `--bg-to` に置換した。しかし以下の 2 箇所で `var(--bg)` 参照が残っている：

- `src/components/CalendarView.tsx:217`: カレンダーの空セル背景
- `src/components/HeroCard.tsx:289`: Discord 名入力欄背景

CSS 変数が未定義の場合 `background: var(--bg)` は無効値となり、`background` プロパティ自体が初期値（transparent）に戻る。結果として：

- 空セル → 親の `var(--border)` グリッド色がそのまま透ける（意図しない見た目）
- 入力欄 → 透明化し、placeholder の視認性とフォーカス時の差別化が低下

修正案: 両者とも `var(--glass)`（または用途に応じて `var(--card)`）に置換する。

### 所見 #3: オレンジアクセントボーダーの消失

`AnnouncementForm.tsx:70-71` の li では：

```tsx
className="... border-l-2 border-orange-500/60"
style={{ background: "var(--glass)", borderColor: "var(--glass-border)" }}
```

Tailwind の `border-orange-500/60` は CSS で `border-color: rgb(...)` を 4 辺全部に適用するが、inline `borderColor` で全辺が上書きされる。結果として **左側のオレンジアクセントが消える**。お知らせ項目を視覚的に強調するための重要な UI 要素のため、UX リグレッション。

修正案: 以下のいずれか
- inline で `borderLeftColor: "rgba(249,115,22,0.6)"` を明示し、それ以外を `borderColor` で指定
- inline `borderColor` を削除し、Tailwind 側で `border-l-2 border-orange-500/60 border-y border-r border-y-white/10 border-r-white/10` のように全辺を指定
- お知らせの li を `border-l-2 border-orange-500/60` 単独に戻し、background のみ `var(--glass)` に統一

## フォローアップ提案

- 所見 #4: dead-code な `animate-glow-pulse` className を削除し、`style.animation` 一本に統一するか、逆に tailwind 任意値構文に揃える。
- 所見 #5: `globals.css` 末尾に `@media (prefers-reduced-motion: reduce) { .animate-iridescent, .animate-glow-pulse { animation: none !important; } }` を追加する（プラン記載のリスク対策の実装漏れ）。
- 所見 #6: iridescent の色を `--iridescent-stop-1/2/3` のような CSS 変数に集約。
- 所見 #7: glass 関連変数の命名統一。
- 所見 #8: プラン本文を `globals.css` 直接修正に合わせるか、layout.tsx 経由に揃える。
- 所見 #9: body の `background-color` フォールバック追加。
- 所見 #10: upcoming バッジの blur 差分について意図をコメント化、または他状態との一貫性を取る。
- 所見 #11: 用途のない `animation: iridescent` は削除するか、HeroCard を `animate-iridescent animate-glow-pulse` クラス使用に書き換えて整合させる。

## 確認済み項目

- [x] 不要な変更（所見 #1, #2 で問題発見）
- [x] 命名の一貫性（所見 #7 で軽微）
- [x] 可読性（所見 #3, #4 で問題発見）
- [x] タイポ・コピペミス（問題なし）
- [x] null 安全性（該当ロジック変更なし）
- [x] デバッグコード（なし）
- [x] シークレット・認証情報（なし）
- [x] 例外処理（該当ロジック変更なし）
- [x] セキュリティ（CSS / マークアップのみ。XSS / インジェクションリスクなし）
- [x] 保守性（所見 #4, #6, #10 で改善余地）

## 判定

**修正後マージ**

理由: CRITICAL 級は不在で、停止すべき重大欠陥はない。しかし `var(--bg)` 参照の置換漏れ（#1 / #2）と `AnnouncementForm` のオレンジアクセント消失（#3）は HIGH 級の視覚リグレッションであり、PR 前に必ず修正すること。所見 #4 / #5 もマージ前の小修正で済むため同時に対応推奨。
