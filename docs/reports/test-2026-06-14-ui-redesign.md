# テストレポート

**Date**: 2026-06-14
**Plan**: [docs/plans/active/2026-06-14-ui-redesign.md](../plans/active/2026-06-14-ui-redesign.md)
**Branch**: feat/ui-redesign
**Runner**: `./scripts/run-test.sh` → `./scripts/test.local.sh` → `npx vitest run --reporter=verbose`
**Evidence**: [docs/evidence/test-2026-06-14-015834.log](../evidence/test-2026-06-14-015834.log)

## テスト実行

```
==> npx vitest run

 RUN  v3.2.6 /Users/shimizutoorushin/ghq/github.com/IdeaxTech/community-status

 Test Files  6 passed (6)
      Tests  85 passed (85)
   Start at  10:58:35
   Duration  637ms (transform 203ms, setup 0ms, collect 213ms, tests 657ms, environment 0ms, prepare 456ms)

==> すべてのテストがパスしました。
```

テストファイル内訳:

| ファイル | 通過 |
|---------|------|
| `src/lib/discord.test.ts` | 4 |
| `src/lib/db.test.ts` | 21 |
| `src/app/api/status/route.test.ts` | 3 |
| `src/app/api/checkin/route.test.ts` | 13 |
| `src/app/api/announcements/route.test.ts` | 11 |
| `src/app/api/calendar/route.test.ts` | 33 |
| **計** | **85** |

## 結果サマリー

| カテゴリ | 件数 |
|---------|------|
| 通過    | 85   |
| 失敗    | 0    |
| スキップ | 0   |

実行時間: 637ms（合計）。順序非依存・決定論的に成功。

## カバーされた ui-redesign 関連の振る舞い

`feat/ui-redesign` ブランチ（`9a2812e`〜`HEAD` + 作業ツリー差分）が触れた領域のうち、既存スイートが実際に確認している項目:

| 振る舞い | エビデンス |
|---------|-----------|
| `GET /api/status` が `attendees: {name, status}[]` を返す | `src/app/api/status/route.test.ts:20-42` で `attendees`・`count`・`names` の三者を assert |
| `GET /api/status` の attendees デフォルト status は `at_venue` | `route.test.ts:40` で `attendees.every((a) => a.status === "at_venue")` |
| `GET /api/status` の `names` 後方互換フィールドが残っている | `route.test.ts:27, 41, 51` |
| `GET /api/status` が UTF-8 特殊文字を保持 | `route.test.ts:44-52` (`日本語ユーザー🎉`) |
| `POST /api/checkin` の status 省略時デフォルト（暗黙） | `route.test.ts:28-35` happy path（assert は name のみだが route 経路で `addCheckin(name, "at_venue")` を踏む） |
| `db.ts` の `addCheckin` / `getCheckins` / `removeCheckin` の CRUD・冪等性・JST 日付ロールオーバー | `src/lib/db.test.ts` checkins/date rollover ブロック（14 ケース） |

## 失敗の分析

なし。85 ケースすべてが通過。

## カバレッジギャップ

ui-redesign で導入された新規 / 変更コードのうち、**自動テストでカバーされていない** ものを以下にフラグする。判定への影響は無いが（プラン本体がテンプレートのまま受け入れ基準を定義していないため、テストプラン上は何も要求されていない）、回帰検出力の観点で記録する。

### High（API 契約に直接関わる挙動）

1. **`POST /api/checkin` の `status` フィールド受理パス**
   - 対象: `src/app/api/checkin/route.ts:6-8, 16-17` の `isCheckinStatus` 型ガード + `addCheckin(name, status)` 第 2 引数。
   - 未カバー:
     - `status: "on_the_way"` 明示指定時に DB に "on_the_way" として永続化される happy path
     - `status: "invalid_string"` のような不正値で `"at_venue"` にフォールバックする型ガードの境界
     - `status: null` / `status: 42` / `status` 欠落での `"at_venue"` フォールバック
   - リスク: 型ガードを `VALID_STATUSES.includes(v as CheckinStatus)` から例えば直接代入に退化させても、現行スイートは緑のまま通る。`/verify` レポート AC-8 が型ガード採用を満たすと判定しているが、振る舞いを固定するテストは無い。

2. **`GET /api/status` の attendees に `on_the_way` ステータスが混在するケース**
   - 対象: `src/app/api/status/route.ts` の `attendees` シリアライズ。
   - 未カバー: 一人が `at_venue`、別の一人が `on_the_way` でチェックインした状況での `attendees` フィールドの形・並び順・count 算定。現状の `count` が `on_the_way` も計上するのか、それとも在席のみカウントするのかが仕様としてもテストとしても固定されていない。

3. **`db.ts` の `status` カラム永続化と既存 DB へのマイグレーション**
   - 対象: `src/lib/db.ts:38-43` の `ALTER TABLE ... catch {}` と `checkins.status TEXT NOT NULL DEFAULT 'at_venue'` 列。
   - 未カバー:
     - `status` カラムを持たない既存 SQLite ファイルを起動時に検出 → `ALTER TABLE` が走り、以後 `addCheckin(name, "on_the_way")` が永続化される統合シナリオ
     - `addCheckin` 第 2 引数の status が `getCheckins()` / `attendees` でラウンドトリップする `db.test.ts` レベルのユニット
   - 現行 `db.test.ts` の checkins セクションは旧 API シグネチャ（status 引数なし）のみを叩いているため、status 列の永続化は実装ファイル経由で間接的にしか試されていない。

### Medium（UI / フロント側のロジック）

4. **`HeroCard.tsx` の参加状態切替 UI**
   - 対象: `src/components/HeroCard.tsx`（12K、`handleCheckin` / `handleCheckout` で `POST /api/checkin` と `DELETE /api/checkin` を駆動。状態選択を含む新規コンポーネント）。
   - 未カバー: status 選択 → API 呼び出し → トースト表示 → `attendees` 再取得という E2E パス。リポジトリに React Testing Library / Playwright のセットアップ無し（calendar 報告書と同じ状況）。

5. **`Toaster.tsx` + `useToast.ts`**
   - 対象: `src/components/Toaster.tsx`, `src/hooks/useToast.ts`（新規 0 → 1 機能）。
   - 未カバー: トーストの表示・自動消去のタイマー・複数キュー時の挙動。純粋関数として切り出されていればユニット化容易だが、現状フックとして実装されているため component test harness を要する。

6. **ダークモード CSS / Tailwind トークン**
   - 対象: `src/app/globals.css`（CSS 変数 + `prefers-color-scheme: dark`）, `tailwind.config.ts`（`darkMode: "media"`・`fade-up`・`pulse-slow` アニメーション）。
   - 未カバー: 視覚回帰テスト（VRT）はリポジトリにセットアップ無し。本フェーズの責務外。

### Low（自己レビュー追跡項目）

7. **`MainPage.reloadRef` の削除痕跡**
   - 自己レビュー HIGH#3 の修正で `reloadRef` 自体が削除済み（verify report AC-7）。テスト的にはコードが存在しないことを保証する仕組みは無いが、TypeScript の型エラーで自然に検出される。テスト追加は不要。

8. **`StatusBoard.tsx` / `CheckinForm.tsx` のデッドコード削除**
   - 同様。`git ls-files` で消えていることが verify で確認済み。ビルド時に存在しないと型エラーになるため、ガードはコンパイラに委譲して可。

### ベリファイプラン未指定によるギャップ

`docs/plans/active/2026-06-14-ui-redesign.md` のテストプランは空欄（テンプレートのまま）。したがって本フェーズで「テストプランで指定されたが実行できなかった」項目は無い一方、**何を確認すべきかをプラン側が一切定義していない** という構造的ギャップが残る。verify レポートが指摘したのと同じ問題で、`/sync-docs` または `/pr` 前にプラン本体をユーザーと合意した受け入れ基準で埋めること推奨。

## 追加で記録した観点（既存テストが間接的に固定している ui-redesign 関連の振る舞い）

- **`names` 後方互換フィールドの保持** — `status/route.test.ts` の 3 ケースすべてが `names` を assert しており、`attendees` 追加に伴って `names` を撤去する退化を一発で検出する。これは PR レビューで「`names` は消していい？」という質問が出たときの即答エビデンス。
- **空チェックイン状態の正準形** — `status/route.test.ts:23-28` が `count: 0, attendees: [], names: []` を固定。フロント側が `attendees` を nullable として扱う必要が無いことを保証。
- **`addCheckin` の旧シグネチャ互換** — `db.test.ts` checkins セクションが `addCheckin(name)` を引数 1 つで呼び続けてパスしているため、status 引数を必須化する退化を即検出する（現実装は第 2 引数オプショナル + デフォルト `'at_venue'`）。

## フレーキー所見

なし。`vi.resetModules()` + 一時 SQLite ディレクトリ + 環境変数クリーンアップというパターンが全テストで一貫しており、ローカル実行 637ms で順序非依存に通る。calendar フェーズで導入された `vi.useRealTimers()` 系設定も維持されている。

## 判定

**pass**

理由: `./scripts/run-test.sh` 経由で `npx vitest run` が 6 ファイル / 85 ケースすべてを 637ms でパス（失敗 0・スキップ 0）。ui-redesign が触れた `GET /api/status` の `attendees` フィールド追加・`names` 後方互換・JST 日付ロールオーバー・チェックイン CRUD など、API 契約レベルの主要な振る舞いは既存スイートで固定されている。プラン本体のテストプランが空欄のため「プラン指定の網羅率」は計測不能だが、PR ゲートとしての「全テスト通過」条件は満たしている。

ただし以下の構造的注意点を `/sync-docs` / `/pr` 担当に申し送る:

- ui-redesign 固有のコードパス（`POST /api/checkin` の `status` 受理、`on_the_way` 混在時の attendees シリアライズ、既存 DB への `ALTER TABLE` マイグレーション）には**直接のテストが無い**。本判定は「既存スイートが緑」を根拠にするもので、「新挙動が網羅された」を意味しない。
- プラン本体（受け入れ基準・テストプラン）が空欄の状態で `/pr` に進む場合、何を検証したかの記録が本レポートと verify レポートしか残らない。プラン未記入は `.claude/rules/planning.md` 違反でもあるため、最低限プランに受け入れ基準を追記してから `/pr` を作成することを強く推奨。

次のステップ: pass → `/sync-docs` へ
