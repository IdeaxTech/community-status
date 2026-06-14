# プラン: ui-redesign

**Date**: 2026-06-14
**Type**: feat
**Branch**: feat/ui-redesign
**Related issue**: N/A
**Related request**: ui-redesign

## 目的

トップページの UI を「現地状況がひと目でわかる」ヒーロー型レイアウトに刷新し、
チェックインに「在席中 / 向かっています」の状態を持たせる。
あわせてダークモード対応・フォント取得方式の安全化・トースト通知の導入を行い、
今後のレビュー／改修コストを下げる。

## スコープと非ゴール

**スコープ**:
- `HeroCard.tsx` の新規追加（参加人数・参加者一覧・セッション状態バッジ・チェックインフォーム統合）
- `Toaster.tsx` + `useToast` フックによる成功・失敗トースト通知
- 旧 `StatusBoard.tsx` と `CheckinForm.tsx` の削除（HeroCard へ統合済み）
- `MainPage` / `AnnouncementForm` / `CalendarView` をダークモード対応の CSS 変数テーマに刷新
- `globals.css` にライト/ダーク両対応の CSS 変数（`--bg` / `--card` / `--border` / `--text` / `--muted`）と `.card` / `.text-muted` ユーティリティを追加
- Google Fonts の外部 `@import` を `next/font/google` の Inter に置き換え
- `checkins.status` カラム追加（`"at_venue"` / `"on_the_way"`、`ALTER TABLE ... ADD COLUMN` で既存 DB に冪等適用）
- `GET /api/status` のレスポンスに `attendees: { name, status }[]` を追加（既存 `names: string[]` も互換のため残す）
- `POST /api/checkin` の `status` パラメータ受け入れと型ガードによる検証

**非ゴール**:
- ユーザー認証・ログイン機能の追加
- 手動でのライト/ダーク切り替え UI（OS 設定の `prefers-color-scheme` に追従）
- 多言語対応
- 状態追加に伴う通知文面の Discord 側変更
- カレンダー機能の挙動変更

## 前提

- 既存の SQLite スキーマと API 契約は後方互換を維持する
- `next/font/google` のセルフホストは Next.js 15 標準で利用可能
- Tailwind v3 の preflight を前提とした CSS 変数テーマ

## 影響ファイル・システム

```
src/
├── app/
│   ├── globals.css                   # CSS 変数テーマ・.card/.text-muted ユーティリティ追加
│   ├── layout.tsx                    # next/font/google Inter 適用・Viewport 追加
│   └── api/
│       ├── checkin/route.ts          # status パラメータ受け入れ＋型ガード
│       └── status/route.ts           # attendees: {name, status}[] 追加（names は互換）
├── lib/
│   └── db.ts                         # CheckinStatus 型・checkins.status カラム追加と CRUD 更新
├── hooks/
│   └── useToast.ts                   # 新規: トースト用フック
└── components/
    ├── MainPage.tsx                  # HeroCard + Toaster の合成へ刷新
    ├── HeroCard.tsx                  # 新規: 参加状況・セッション状態・チェックイン統合
    ├── Toaster.tsx                   # 新規: トースト UI
    ├── AnnouncementForm.tsx          # CSS 変数テーマへ移行
    ├── CalendarView.tsx              # CSS 変数テーマへ移行
    ├── StatusBoard.tsx               # 削除（HeroCard へ統合）
    └── CheckinForm.tsx               # 削除（HeroCard へ統合）
tailwind.config.ts                    # fade-up / pulse-slow アニメーション追加
```

## 受け入れ基準

- [x] トップページに HeroCard が表示され、本日のセッション状態（開催中 / 本日開催 / 本日終了 / 次回）バッジが切り替わる
- [x] チェックイン時に「在席中」または「向かっています」を選択できる
- [x] 参加者一覧に各人のステータスバッジが表示される
- [x] `GET /api/status` が `count` / `attendees: [{name, status}]` / `names: string[]`（互換）を返す
- [x] `POST /api/checkin` で `status` を省略した場合は `at_venue` にフォールバックする
- [x] 不正な `status` 値は受け付けず `at_venue` にフォールバックする（型ガード経由）
- [x] OS のダークモード設定に追従して配色が切り替わる
- [x] 旧 `StatusBoard.tsx` / `CheckinForm.tsx` は src/ から削除されている
- [x] Google Fonts は外部 `@import` ではなく `next/font/google` の Inter で読み込まれる
- [x] 投稿成功・失敗時にトースト通知が表示される

## 設計決定

**API 後方互換**: `/api/status` は `names: string[]` を `attendees` と並行で返し、既存クライアントを壊さない。
将来削除する際は `@deprecated` コメントで明示する。

**ダークモードは `prefers-color-scheme` のみ**: 手動切替トグルは追加しない。
状態保持・FOUC 対策・ARIA 配慮のコストを避け、OS 設定追従にとどめる。

**フォントは `next/font/google`**: 外部 `@import` は (a) クライアント IP の Google への漏洩、
(b) レンダリングブロッキング、(c) 将来の CSP `style-src` 違反のリスクがあるため、
ビルド時セルフホスト化に切り替える。

**`checkins.status` のマイグレーションは `ALTER TABLE ADD COLUMN` を try-catch**:
既存 DB と新規 DB のいずれでも 1 度の起動で適切に列が用意される。
キャッチした例外は no-op（フォローアップで重複列名のみ握り潰すよう絞る予定）。

## 実装概要

1. **DB / API** — `CheckinStatus` 型と `checkins.status` カラム追加、`/api/checkin` で型ガード、`/api/status` で `attendees` 追加
2. **テーマ層** — `globals.css` に CSS 変数 + `.card` / `.text-muted` ユーティリティ、`tailwind.config.ts` にアニメーション追加
3. **フォント** — `layout.tsx` で `next/font/google` の Inter を適用し、`@import` を撤去
4. **UI コンポーネント刷新** — `HeroCard` / `Toaster` 新規、`MainPage` を統合、`AnnouncementForm` / `CalendarView` をテーマ対応に移行、旧 `StatusBoard` / `CheckinForm` を削除
5. **フック** — `useToast` を新設し、`MainPage` 経由で `HeroCard` に渡す

## ベリファイプラン

- 静的解析: `./scripts/run-verify.sh`
- スペック適合: 受け入れ基準を 1 つずつ確認
- ドキュメントドリフト: README が新コンポーネント構成・API 形・`checkins.status` を反映しているか
- 後方互換: `/api/status` の `names` フィールドが残っているか

## テストプラン

- ユニットテスト:
  - `src/lib/db.ts` — `addCheckin(name, status)` のデフォルト引数・上書き挙動
  - `src/app/api/checkin/route.test.ts` — `status` 省略・不正値・有効値での挙動
  - `src/app/api/status/route.test.ts` — `attendees` と `names` の両方が返ること、特殊文字を含む名前で壊れないこと
- 統合テスト: 新規不要（既存スイートをグリーンに保つ）
- エッジケース: 同一名で `at_venue` → `on_the_way` を切り替えた時の上書き、日付またぎリセット時のステータス保持なし

## リスクレジスター

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| `names` 互換フィールドの忘れた削除 | 既存クライアント破壊 | 低 | README と route コメントで「backward-compat」を明示 |
| `ALTER TABLE` の例外を広く握り潰している | 真の I/O エラーが見えなくなる | 中 | フォローアップで「duplicate column name」のみ no-op に絞る |
| ダークモード未テスト環境での視認性低下 | UX 低下 | 中 | コントラスト目視確認 + 主要画面の手動チェック |

## ロールアウト・ロールバック

- ロールアウト: 通常の PR マージ。DB マイグレーションは起動時に冪等適用されるため特別な手順なし
- ロールバック: PR を revert。`checkins.status` カラムは残るが、旧コードからは無視されるため害なし

## 進捗チェックリスト

- [x] 実装完了
- [x] `./scripts/run-verify.sh` パス
- [x] `/self-review` 完了（`docs/reports/self-review-2026-06-14-ui-redesign.md`）
- [x] `/verify` 完了（`docs/reports/verify-2026-06-14-ui-redesign.md`）
- [x] `/test` 完了（`docs/reports/test-2026-06-14-ui-redesign.md`）
- [x] `/sync-docs` 完了（README とプランを ui-redesign 実装に同期）
- [ ] `/pr` 作成済み
