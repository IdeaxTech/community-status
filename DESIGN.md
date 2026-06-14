# Apple Liquid Glass UI — DESIGN.md

> WWDC 2025 で発表された **Liquid Glass** は、iOS 7 以来最大のデザイン刷新。  
> iOS 26 / iPadOS 26 / macOS Tahoe 26 / watchOS 26 / tvOS 26 に統一されたビジュアル言語。

---

## 目次

1. [デザイン哲学](#1-デザイン哲学)
2. [コアビジュアルプロパティ](#2-コアビジュアルプロパティ)
3. [レイヤー構造](#3-レイヤー構造)
4. [カラーシステム](#4-カラーシステム)
5. [タイポグラフィ](#5-タイポグラフィ)
6. [形状・角丸ルール](#6-形状角丸ルール)
7. [CSS 実装ガイド](#7-css-実装ガイド)
8. [コンポーネント別実装](#8-コンポーネント別実装)
9. [アニメーション・モーション](#9-アニメーションモーション)
10. [アクセシビリティ](#10-アクセシビリティ)
11. [NG パターン](#11-ng-パターン)
12. [チェックリスト](#12-チェックリスト)

---

## 1. デザイン哲学

Liquid Glass は **マテリアルシステム** であり、単なるビジュアルスキンではない。

| 原則 | 説明 |
|---|---|
| **透過性 (Translucency)** | 背景コンテンツを透かして見せ、コンテキストを維持する |
| **屈折 (Refraction)** | 光がガラスを通るときのように、背景を歪ませて奥行きを表現する |
| **適応性 (Adaptivity)** | 背景のコンテンツ・ライト・ユーザーインタラクションに応じてリアルタイムに変化する |
| **コンテンツ優先 (Content-first)** | UIコントロールは視覚的に後退し、コンテンツが主役になる |
| **流動性 (Fluidity)** | スクロール・タップ・遷移がガラスの物理特性に従って動く |

> "It's not just visual polish — we're redefining how digital surfaces interact with light and user intent."  
> — Alan Dye, VP of Human Interface Design, Apple

---

## 2. コアビジュアルプロパティ

### 2.1 ガラスマテリアルの4要素

```
┌─────────────────────────────────────────────────┐
│  1. TINT LAYER        (色調・透明度レイヤー)     │
│  2. LENS/GLASS LAYER  (屈折・ぼかしレイヤー)    │
│  3. SPECULAR LAYER    (ハイライト・光沢レイヤー) │
│  4. SHADOW/DEPTH      (影・奥行きレイヤー)       │
└─────────────────────────────────────────────────┘
```

### 2.2 光学的特性

- **Lensing（レンジング）**: 水滴のように光を屈折させ、背景コンテンツを歪ませる
- **Specular Highlights**: ガラス表面の鏡面反射によるハイライト
- **Frosted Blur**: すりガラス効果による背景のぼかし
- **Scroll Edge Effects**: スクロール境界での視覚的セパレーション

---

## 3. レイヤー構造

Liquid Glass は以下の **3層スタック** で構成される:

```
┌──────────────────────────────────┐
│  LAYER 3: Tint                   │  ← rgba() による色調
│  opacity: 0.15–0.25              │
├──────────────────────────────────┤
│  LAYER 2: Glass (Lens)           │  ← backdrop-filter: blur()
│  blur: 20–40px                   │     + SVG displacement map
├──────────────────────────────────┤
│  LAYER 1: Background Content     │  ← 実際のコンテンツ・壁紙
└──────────────────────────────────┘
```

各レイヤーは **独立して opacity を持ち**、インタラクションに応じて動的に変化する。

---

## 4. カラーシステム

### 4.1 Liquid Glass バリアント

Apple は **Light / Dark × 3モード** の計6バリアントを提供:

| バリアント | 用途 | 背景透明度 |
|---|---|---|
| Default Light | 標準ライトモード | 20–30% |
| Default Dark | 標準ダークモード | 15–25% |
| Clear Light | 透明度が高い（ライト） | 10–15% |
| Clear Dark | 透明度が高い（ダーク） | 8–12% |
| Tinted Light | ブランドカラーのティント | 25–35% |
| Tinted Dark | ブランドカラーのティント（ダーク） | 20–30% |

### 4.2 CSS カスタムプロパティ（トークン）

```css
:root {
  /* === Glass Base === */
  --glass-bg-light:        rgba(255, 255, 255, 0.22);
  --glass-bg-dark:         rgba(30,  30,  30,  0.20);
  --glass-bg-clear-light:  rgba(255, 255, 255, 0.12);
  --glass-bg-clear-dark:   rgba(20,  20,  20,  0.10);

  /* === Blur === */
  --glass-blur-sm:   12px;
  --glass-blur-md:   24px;
  --glass-blur-lg:   40px;
  --glass-blur-xl:   60px;

  /* === Borders === */
  --glass-border-light: rgba(255, 255, 255, 0.45);
  --glass-border-dark:  rgba(255, 255, 255, 0.12);

  /* === Specular Highlights === */
  --glass-highlight-top:    rgba(255, 255, 255, 0.70);
  --glass-highlight-inner:  rgba(255, 255, 255, 0.30);

  /* === Shadows === */
  --glass-shadow-sm:  0 2px 8px rgba(0, 0, 0, 0.10);
  --glass-shadow-md:  0 8px 32px rgba(0, 0, 0, 0.18);
  --glass-shadow-lg:  0 20px 60px rgba(0, 0, 0, 0.25);

  /* === Tint Colors === */
  --glass-tint-blue:    rgba(0,  122, 255, 0.20);
  --glass-tint-purple:  rgba(175, 82, 222, 0.20);
  --glass-tint-green:   rgba(52,  199, 89,  0.20);
  --glass-tint-neutral: rgba(120, 120, 128, 0.18);

  /* === Radius === */
  --radius-capsule: 9999px;
  --radius-xl:      28px;
  --radius-lg:      20px;
  --radius-md:      14px;
  --radius-sm:      10px;

  /* === Motion === */
  --duration-fast:   120ms;
  --duration-normal: 250ms;
  --duration-slow:   400ms;
  --ease-glass:      cubic-bezier(0.34, 1.56, 0.64, 1); /* spring */
  --ease-smooth:     cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@media (prefers-color-scheme: dark) {
  :root {
    --glass-bg:     var(--glass-bg-dark);
    --glass-border: var(--glass-border-dark);
  }
}

@media (prefers-color-scheme: light) {
  :root {
    --glass-bg:     var(--glass-bg-light);
    --glass-border: var(--glass-border-light);
  }
}
```

---

## 5. タイポグラフィ

Liquid Glass UI では **テキストの可読性** が最重要。ガラス背景上では:

```css
/* システムフォント優先（Apple SF Pro に最適化） */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
             "Helvetica Neue", sans-serif;

/* 階層 */
--text-display:   clamp(28px, 5vw, 48px);   /* ヒーロータイトル */
--text-title:     clamp(20px, 3vw, 28px);   /* セクションタイトル */
--text-body:      16px;                      /* 本文 */
--text-caption:   13px;                      /* キャプション */
--text-micro:     11px;                      /* バッジ・ラベル */

/* ガラス背景上のテキスト: 影で視認性を確保 */
.glass-text {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  -webkit-font-smoothing: antialiased;
}

.glass-text--dark {
  color: rgba(0, 0, 0, 0.85);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.30);
}
```

**コントラスト確保ルール**:
- ガラス上の文字: **WCAG AA 以上 (4.5:1)** を必須とする
- 重要なテキストはガラス背景を避けるか、不透明なラベルを使用する

---

## 6. 形状・角丸ルール

### 6.1 カプセル主義

Liquid Glass では **カプセル型 (pill shape)** が支配的。

```
ボタン・タブバー   → border-radius: 9999px  (カプセル)
カード・シート     → border-radius: 28–32px  (大きな角丸)
コントロール       → border-radius: 14–20px  (中程度)
インライン要素     → border-radius: 10–12px  (小さめ)
```

### 6.2 入れ子の角丸（同心円ルール）

外側コンテナが `border-radius: 28px` なら、内側要素は差を引いた値に:

```css
/*
  外側: 28px
  内側余白: 8px
  内側要素: 28px - 8px = 20px
*/
.outer-glass { border-radius: 28px; padding: 8px; }
.inner-element { border-radius: 20px; } /* 同心円を保つ */
```

### 6.3 スクリーンエッジでの注意

- スマートフォン端付近のカプセルは **追加の margin** を設ける
- iPad / Mac では、ウィンドウエッジに対して **同心円形状** を揃える

---

## 7. CSS 実装ガイド

### 7.1 基本ガラスカード

```css
.glass-card {
  /* マテリアル */
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur-md)) saturate(1.8);
  -webkit-backdrop-filter: blur(var(--glass-blur-md)) saturate(1.8);

  /* 形状 */
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border-light);

  /* 奥行き */
  box-shadow:
    var(--glass-shadow-md),
    inset 0 1px 0 var(--glass-highlight-top),    /* 上部ハイライト */
    inset 0 -1px 0 rgba(0, 0, 0, 0.05);          /* 下部シャドウ */

  /* コンテンツ */
  padding: 24px;
  color: rgba(255, 255, 255, 0.92);
}

@media (prefers-color-scheme: dark) {
  .glass-card {
    background: var(--glass-bg-dark);
    border-color: var(--glass-border-dark);
  }
}
```

### 7.2 ガラスボタン（カプセル型）

```css
.glass-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;

  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur-sm)) saturate(1.6);
  -webkit-backdrop-filter: blur(var(--glass-blur-sm)) saturate(1.6);

  border-radius: var(--radius-capsule);
  border: 1px solid var(--glass-border-light);

  box-shadow:
    var(--glass-shadow-sm),
    inset 0 1px 0 rgba(255, 255, 255, 0.60),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);

  font-size: 15px;
  font-weight: 590;  /* SF Pro の semibold に近い */
  color: rgba(255, 255, 255, 0.95);
  cursor: pointer;

  transition:
    transform      var(--duration-fast)   var(--ease-glass),
    box-shadow     var(--duration-fast)   var(--ease-smooth),
    background     var(--duration-fast)   var(--ease-smooth);
}

.glass-button:hover {
  background: rgba(255, 255, 255, 0.30);
  box-shadow:
    var(--glass-shadow-md),
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -1px 0 rgba(0, 0, 0, 0.10);
}

.glass-button:active {
  transform: scale(0.96);
  box-shadow:
    var(--glass-shadow-sm),
    inset 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* フォーカス (アクセシビリティ) */
.glass-button:focus-visible {
  outline: 2px solid rgba(0, 122, 255, 0.8);
  outline-offset: 2px;
}
```

### 7.3 ガラスナビゲーションバー

```css
.glass-navbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);

  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  margin-bottom: 20px; /* セーフエリア考慮 */
  margin-bottom: max(20px, env(safe-area-inset-bottom));

  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(var(--glass-blur-lg)) saturate(2.0);
  -webkit-backdrop-filter: blur(var(--glass-blur-lg)) saturate(2.0);

  border-radius: var(--radius-capsule);
  border: 1px solid rgba(255, 255, 255, 0.40);

  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.20),
    0 2px 8px rgba(0, 0, 0, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

/* スクロール時に縮小するタブバー */
.glass-navbar--scrolled {
  padding: 8px 12px;
  gap: 2px;
  transition: all var(--duration-normal) var(--ease-smooth);
}
```

### 7.4 モーダル / シート

```css
.glass-sheet {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(var(--glass-blur-xl)) saturate(1.9);
  -webkit-backdrop-filter: blur(var(--glass-blur-xl)) saturate(1.9);

  border-radius: var(--radius-xl) var(--radius-xl) 0 0; /* 上だけ角丸 */
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-bottom: none;

  box-shadow:
    0 -4px 60px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.70);

  padding: 24px;
}

/* ドラッグハンドル */
.glass-sheet__handle {
  width: 36px;
  height: 5px;
  background: rgba(120, 120, 128, 0.40);
  border-radius: var(--radius-capsule);
  margin: 0 auto 16px;
}
```

### 7.5 SVG Displacement Map（本格的なレンジング効果）

CSS の `backdrop-filter` だけでは Apple の **lensing（光の屈折）** を完全再現できない。  
SVG の `feTurbulence` + `feDisplacementMap` で近似する:

```html
<!-- SVG フィルター定義（非表示） -->
<svg style="position:absolute;width:0;height:0" aria-hidden="true">
  <defs>
    <filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%">
      <!-- ガラスの表面ゆらぎ -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.015 0.015"
        numOctaves="2"
        seed="3"
        result="noise"
      />
      <!-- 屈折マップ -->
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="6"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />
      <!-- ガウスぼかし（すりガラス効果） -->
      <feGaussianBlur stdDeviation="0.5" in="displaced" />
    </filter>
  </defs>
</svg>
```

```css
/* フィルターをガラス要素に適用 */
.glass-lens {
  filter: url(#liquid-glass-filter);
  /* backdrop-filter と組み合わせることで、
     屈折 + ぼかし の複合効果を得る */
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
}
```

> **注意**: SVG フィルターはパフォーマンス負荷が高い。  
> `will-change: transform` と GPU レイヤー分離を忘れずに。

---

## 8. コンポーネント別実装

### 8.1 ガラスカード

```css
/* 基本カード */
.card-glass {
  background: rgba(255, 255, 255, 0.20);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.40);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.20);
  padding: 20px;
  transition: transform var(--duration-normal) var(--ease-glass);
}

.card-glass:hover {
  transform: translateY(-2px) scale(1.01);
}
```

### 8.2 ガラス入力フィールド

```css
.input-glass {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08);

  padding: 12px 16px;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color var(--duration-fast) var(--ease-smooth),
              box-shadow   var(--duration-fast) var(--ease-smooth);
}

.input-glass::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.input-glass:focus {
  border-color: rgba(0, 122, 255, 0.60);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.08),
    0 0 0 3px rgba(0, 122, 255, 0.20);
}
```

### 8.3 ガラストグル / スイッチ

```css
.toggle-glass {
  position: relative;
  width: 52px;
  height: 32px;
  border-radius: var(--radius-capsule);
  background: rgba(120, 120, 128, 0.30);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.20);
  cursor: pointer;
  transition: background var(--duration-normal) var(--ease-smooth);
}

.toggle-glass.active {
  background: rgba(52, 199, 89, 0.75);
  border-color: rgba(255, 255, 255, 0.40);
}

.toggle-glass__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.90);
  transition: transform var(--duration-normal) var(--ease-glass);
}

.toggle-glass.active .toggle-glass__knob {
  transform: translateX(20px);
}
```

### 8.4 ガラスバッジ / タグ

```css
.badge-glass {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-capsule);
  border: 1px solid rgba(255, 255, 255, 0.30);
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.90);
}

/* カラーバリアント */
.badge-glass--blue   { background: rgba(0, 122, 255, 0.22); border-color: rgba(0, 122, 255, 0.35); }
.badge-glass--green  { background: rgba(52, 199, 89, 0.22); border-color: rgba(52, 199, 89, 0.35); }
.badge-glass--red    { background: rgba(255, 59, 48, 0.22); border-color: rgba(255, 59, 48, 0.35); }
.badge-glass--purple { background: rgba(175, 82, 222, 0.22); border-color: rgba(175, 82, 222, 0.35); }
```

---

## 9. アニメーション・モーション

### 9.1 スプリングアニメーション

Liquid Glass の動きは **物理ベースのスプリング** を模倣する。

```css
/* スプリング感のある緩急 */
.glass-spring {
  transition: all var(--duration-normal) var(--ease-glass);
}

/* タップ / クリック時のスケール */
.glass-pressable:active {
  transform: scale(0.94);
  transition-duration: var(--duration-fast);
}
.glass-pressable:not(:active) {
  transition-duration: var(--duration-slow);
  /* リリース時はゆっくり戻る */
}
```

### 9.2 出現アニメーション

```css
@keyframes glass-appear {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(8px);
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    backdrop-filter: blur(var(--glass-blur-md));
  }
}

.glass-modal-enter {
  animation: glass-appear var(--duration-normal) var(--ease-glass) forwards;
}
```

### 9.3 ホバー時の光沢変化

```css
.glass-interactive {
  position: relative;
  overflow: hidden;
}

/* 疑似光沢オーバーレイ */
.glass-interactive::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.25) 0%,
    transparent 50%
  );
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-smooth);
  pointer-events: none;
}

.glass-interactive:hover::before {
  opacity: 1;
}
```

### 9.4 スクロール連動タブバー（JavaScript）

```javascript
const navbar = document.querySelector('.glass-navbar');
let lastScrollY = 0;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const isScrollingDown = scrollY > lastScrollY && scrollY > 60;

  navbar.classList.toggle('glass-navbar--scrolled', isScrollingDown);
  lastScrollY = scrollY;
}, { passive: true });
```

---

## 10. アクセシビリティ

### 10.1 透明度低減モード対応（必須）

```css
/* prefers-reduced-transparency への対応 */
@media (prefers-reduced-transparency: reduce) {
  .glass-card,
  .glass-button,
  .glass-navbar {
    /* ガラス効果を無効化し、不透明な背景に切り替え */
    background: rgba(30, 30, 35, 0.95) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
  }
}
```

### 10.2 モーション低減モード対応（必須）

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 10.3 コントラスト強化モード対応

```css
@media (prefers-contrast: more) {
  .glass-card {
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid rgba(255, 255, 255, 0.80);
    backdrop-filter: none;
  }

  .glass-text {
    color: #ffffff;
    text-shadow: none;
  }
}
```

### 10.4 コントラスト比チェックリスト

| 要素 | 最低コントラスト比 | 推奨 |
|---|---|---|
| 本文テキスト | 4.5 : 1 (WCAG AA) | 7 : 1 |
| 大きなテキスト (18px+) | 3 : 1 | 4.5 : 1 |
| UI コンポーネント境界 | 3 : 1 | — |
| アイコン | 3 : 1 | — |

> ガラス背景は **動的に変化する** ため、背景の明暗の両方でコントラストを確認すること。

---

## 11. NG パターン

| ❌ NG | ✅ OK |
|---|---|
| テキストをガラス背景に直置き（コントラスト不足） | テキストシャドウ + 適切な opacity |
| すべての要素をガラス化（重層ガラス） | ガラスは UI レイヤーのみ、コンテンツは不透明 |
| `blur()` 値が小さすぎる（透明感ゼロ） | `blur(20px)` 以上を推奨 |
| カスタム角丸が入れ子と不一致 | 同心円ルール遵守 |
| アニメーションなしの唐突な出現 | spring ベースの出現演出 |
| アクセシビリティ代替なし | `prefers-reduced-transparency` / `motion` 対応 |
| 過剰なエフェクト重ねがけ | ガラス効果は **1要素に1エフェクト** まで |
| `backdrop-filter` のみ (lensing なし) | SVG displacement map との併用 |
| モバイルで `blur` が重い | `will-change: transform` + GPU 最適化 |

---

## 12. チェックリスト

### デザイン

- [ ] カラートークンをデザインシステムに定義した
- [ ] Light / Dark / Tinted の 6 バリアントを設計した
- [ ] 入れ子の角丸が同心円ルールに従っている
- [ ] すべての要素でコントラスト比を確認した
- [ ] 背景コンテンツがガラス越しに見えるモックを作成した

### 実装

- [ ] `backdrop-filter` と `-webkit-backdrop-filter` を両方設定した
- [ ] `saturate()` を `blur()` と組み合わせた (1.6〜2.0)
- [ ] `inset box-shadow` でハイライトを表現した
- [ ] スプリングイージング (`cubic-bezier(0.34, 1.56, 0.64, 1)`) を使用した
- [ ] `:active` 状態でスケールダウン (0.94〜0.96) を実装した
- [ ] `:focus-visible` でキーボードフォーカスを明示した
- [ ] `env(safe-area-inset-*)` でノッチ・ホームバーを考慮した

### アクセシビリティ

- [ ] `@media (prefers-reduced-transparency: reduce)` で不透明フォールバックを実装した
- [ ] `@media (prefers-reduced-motion: reduce)` でアニメーションを無効化した
- [ ] `@media (prefers-contrast: more)` でコントラストを強化した
- [ ] スクリーンリーダー向け `aria-*` 属性を設定した

### パフォーマンス

- [ ] ガラス要素に `will-change: transform` を設定した
- [ ] `backdrop-filter` の多重ネストを避けた
- [ ] モバイルで blur 値を `sm` (12px) に下げた
- [ ] SVG フィルターを使う場合は GPU レイヤーを分離した

---

## 参考リソース

- [Apple Human Interface Guidelines — Liquid Glass](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple Developer — Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [liquid-glass-react (GitHub)](https://github.com/rdev/liquid-glass-react)
- [Liquid Glass Kit](https://liquidglass-kit.dev/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

*Last updated: June 2026 | Based on iOS 26 / macOS Tahoe 26 design specifications*
