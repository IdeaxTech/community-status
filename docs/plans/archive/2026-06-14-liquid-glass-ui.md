# プラン: Apple Liquid Glass UI + モバイルカレンダー改善

**Date**: 2026-06-14  
**Type**: feat  
**Branch**: `feat/liquid-glass-ui`  
**Related issue**: N/A

---

## 目的

2 つの課題を解消する:

1. **デザインが素朴すぎる** — Apple iOS 26 の Liquid Glass スタイル（フロストガラス + 半透明パネル + 深い宇宙系ダーク背景）に刷新し、技術コミュニティらしい洗練されたルックアンドフィールを提供する
2. **スマホでカレンダーが狭い** — 7列グリッドのセルが小さすぎてタップ・視認が困難。モバイルで使いやすいサイズに改修する

---

## スコープと非ゴール

**スコープ**:
- `globals.css`: Liquid Glass CSS 変数と `.card` ユーティリティを全面刷新（`backdrop-filter: blur`、半透明背景、宇宙系グラデーション）
- `tailwind.config.ts`: glass 関連アニメーション・カラートークン追加
- `src/app/layout.tsx`: body に背景グラデーションクラスを追加
- `HeroCard.tsx`: セッションバッジにアクティブ時のイリデセント（虹色）グロウ追加、カードをガラス化
- `AnnouncementForm.tsx`: 新テーマ変数に合わせたスタイル調整
- `CalendarView.tsx`: モバイルでセル高さ拡大・テキスト調整・タッチターゲット確保

**非ゴール**:
- API / DB の変更なし
- GSAP / Framer Motion などの重いアニメーションライブラリ導入なし
- ロジック変更なし（純粋なビジュアルとレイアウト）
- カレンダーをリスト表示に切り替えるような大きな構造変更なし

---

## 前提

- Tailwind CSS v3（`backdrop-blur`、`bg-white/10` などの opacity 修飾子が使える）
- `backdrop-filter` は主要ブラウザで対応済み（2024年時点で global support 97%+）
- ダーク/ライト両モードを維持する（`prefers-color-scheme: media`）

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `src/app/globals.css` | Liquid Glass テーマに全面刷新 |
| `tailwind.config.ts` | glass アニメーション・カラートークン追加 |
| `src/app/layout.tsx` | body クラスにグラデーション背景を追加 |
| `src/components/HeroCard.tsx` | バッジ・カードのガラス化 |
| `src/components/AnnouncementForm.tsx` | テーマ変数調整 |
| `src/components/CalendarView.tsx` | モバイル対応セルサイズ改修 |

---

## 受け入れ基準

- [ ] カードが `backdrop-filter: blur` のフロストガラス効果で表示される
- [ ] 背景が深い宇宙系グラデーション（ダーク）/ 淡いミスト系（ライト）になる
- [ ] アクティブセッションバッジに虹色グロウ（イリデセント）が入る
- [ ] ライトモードでも文字コントラスト 4.5:1 以上を維持する
- [ ] モバイル（375px）でカレンダーセルが `min-h-[64px]` 以上になり、タップしやすくなる
- [ ] tsc エラーなし、既存テスト全通過（機能変更なし）

---

## 設計決定

**Liquid Glass の実装方法**: CSS カスタムプロパティ + Tailwind ユーティリティ（ライブラリ不使用）
- `backdrop-filter: blur(24px) saturate(180%)` をネイティブ CSS で実装
- グロウ効果は `box-shadow` + CSS グラデーション境界で実現（SVGフィルター不使用）
- Framer Motion は今回導入しない（バンドルサイズ vs 効果の兼ね合い）

**ライトモードの glass**: 高い不透明度（`rgba(255,255,255,0.65)`）でコントラスト確保
- ダークモード: `rgba(255,255,255,0.07)` + blur
- ライトモード: `rgba(255,255,255,0.65)` + blur（淡い青系背景上に浮かぶ白いパネル）

**カレンダーモバイル対応**: `min-h` 拡大 + Tailwind の `sm:` プレフィックスで PC は従来通り
- `min-h-[64px] sm:min-h-[72px]` に変更
- テキストは `text-[10px] sm:text-xs` でモバイルで少し大きめに

---

## 実装概要

### スライス 1 — globals.css + tailwind.config.ts

**globals.css**:
```css
:root {
  /* Light */
  --bg-from: #e8eeff;
  --bg-to: #f0f4ff;
  --glass: rgba(255,255,255,0.65);
  --glass-border: rgba(255,255,255,0.8);
  --card: rgba(255,255,255,0.65);  /* 後方互換 */
  --border: rgba(0,0,0,0.08);
  --text: #0f172a;
  --muted: #475569;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-from: #020510;
    --bg-to: #0a0f1e;
    --glass: rgba(255,255,255,0.06);
    --glass-border: rgba(255,255,255,0.10);
    --card: rgba(255,255,255,0.06);
    --border: rgba(255,255,255,0.10);
    --text: #f1f5f9;
    --muted: #94a3b8;
  }
}
body {
  background: linear-gradient(135deg, var(--bg-from) 0%, var(--bg-to) 100%);
  min-height: 100vh;
}
.card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 1.25rem;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}
```

**tailwind.config.ts**:
- `iridescent` keyframe: 4秒ループのグラデーションシフト（active badge用）
- `glow-pulse` keyframe: 透明度 + box-shadow の pulse（開催中バッジ用）

### スライス 2 — コンポーネント更新

**HeroCard.tsx**:
- `SessionBadge` の active 状態: `animate-iridescent` + glow box-shadow
- attendee list item: `glass` 背景に変更（`bg-white/5 border border-white/10`）

**AnnouncementForm.tsx**:
- input と list item の `style={{ background: "var(--bg)" }}` を `var(--glass)` に
- border を `var(--glass-border)` に統一

### スライス 3 — CalendarView モバイル対応

- セル `min-h-14` → `min-h-[64px] sm:min-h-[72px]`
- セル内 padding: `p-1 sm:p-1.5`
- イベントテキスト: `text-[10px] sm:text-xs`
- 日付番号: `text-xs sm:text-sm font-semibold`
- もくもく会ラベル: `text-[9px] sm:text-xs`（長いので小さめ）
- 追加・編集フォームの input: `min-h-[36px]`（タップターゲット）

---

## ベリファイプラン

- `./scripts/run-verify.sh` → tsc PASS（型変更なし）
- ライトモードのコントラスト: `--text: #0f172a` on `rgba(255,255,255,0.65)` ≈ effectively white → 対比 OK
- `backdrop-filter` は CSS のみで TypeScript 型安全に影響しない

---

## テストプラン

- 既存 Vitest テストが全通過（機能変更なし、API 変更なし）
- ブラウザ目視確認:
  - ダーク/ライトモードの `.card` にフロストガラス効果が出る
  - 375px 幅でカレンダーセルがタップしやすい高さになっている
  - active バッジに虹色グロウが出ている

---

## リスクレジスター

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| `backdrop-filter` が古い環境で効かない | カードが透明になる | 低 | `background: var(--card)` フォールバックあり |
| ライトモードのガラスパネルでコントラスト不足 | WCAG 違反 | 中 | 不透明度を 0.65 以上に設定して実測確認 |
| `animate-iridescent` が `prefers-reduced-motion` 無視 | アクセシビリティ | 低 | `@media (prefers-reduced-motion)` で無効化 |

---

## ロールアウト・ロールバック

- 機能変更なし → ロールバックは CSS/コンポーネントの差し戻しのみ
- 既存テストは全て通過するはず（API 変更なし）

---

## 進捗チェックリスト

- [x] スライス 1: globals.css + tailwind.config.ts
- [x] スライス 2: HeroCard + AnnouncementForm
- [x] スライス 3: CalendarView モバイル対応
- [x] `./scripts/run-verify.sh` PASS
- [x] self-review 完了（`docs/reports/self-review-2026-06-14-liquid-glass-ui.md` — HIGH 所見は修正済み: `--bg` 復元、`prefers-reduced-motion` 追加）
- [x] verify 完了（`docs/reports/verify-2026-06-14-liquid-glass-ui.md` — PASS）
- [x] test 完了（`docs/reports/test-2026-06-14-liquid-glass-ui.md` — PASS, 105/105）
- [x] sync-docs 完了
- [ ] PR 作成済み
