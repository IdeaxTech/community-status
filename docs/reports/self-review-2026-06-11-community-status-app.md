# 自己レビューレポート

**Date**: 2026-06-11
**Plan**: docs/plans/active/2026-06-11-community-status-app.md
**Diff**: commit 1b935df (`feat: add community-status Next.js app with check-in and venue announcements`) on branch `feat/community-status-app`

## サマリー

新規 Next.js アプリ（App Router + better-sqlite3 + Discord Webhook）の 1 コミット 820 行追加。全体的に小さく読みやすい構造で、シークレットの混入や明らかなインジェクション欠陥は見当たらない。一方で、`todayJst()` のタイムゾーン処理は移植性に問題があり、API 層には入力長/レート制御・例外処理・Discord メンション抑止が欠けている。verify.sh の TypeScript 分岐に二重カウントの軽微な論理バグもある。CRITICAL は無いが、HIGH 1 件（JST 計算の移植性）と修正後マージが望ましい中位の所見が複数。

## 所見

| # | 深刻度 | カテゴリ | ファイル:行 | 説明 |
|---|--------|----------|------------|------|
| 1 | HIGH | 保守性/正確性 | src/lib/db.ts:32-38 | `todayJst()` がホスト TZ に依存して誤動作。UTC+14 のような JST より先行する TZ ホストでは前日付を返すことを実証 |
| 2 | HIGH | 例外処理 | src/lib/discord.ts:8-14 / src/app/api/announcements/route.ts:14-17 | `fetch` のネットワーク失敗・非 2xx をハンドルしておらず、Discord 障害時に announcement の保存が成功していても API が 500 を返す |
| 3 | HIGH | セキュリティ/濫用 | src/app/api/announcements/route.ts:9-17 / src/lib/discord.ts:11 | content をそのまま Discord に送るため、ユーザが `@everyone`/`@here`/`<@&role>` を含めるとサーバ全体をメンションできる。Webhook の `allowed_mentions: { parse: [] }` 等で抑止すべき |
| 4 | MEDIUM | 保守性 | next.config.ts:4-6 | `experimental.serverComponentsExternalPackages` は Next.js 15 で `serverExternalPackages`（非 experimental）にリネーム済み。15.5 系では Deprecation 警告が出る可能性 |
| 5 | MEDIUM | セキュリティ/DoS | src/app/api/announcements/route.ts:11 / src/app/api/checkin/route.ts:6,16 | content / discord_name に最大長チェックがない。任意の長さの文字列を SQLite に書き込み・Discord に転送可能 |
| 6 | MEDIUM | セキュリティ/濫用 | src/app/api/announcements/route.ts 全体 | 認証なし API かつレート制御なしのため、誰でも Discord Webhook を介して投稿をフラッディングできる。リスクレジスタには「名前の成りすまし」しか記載されておらず、フラッディングは未掲載 |
| 7 | MEDIUM | 論理バグ | packs/languages/typescript/verify.sh:17-30 | グローバル `tsc` が無く `node_modules/.bin/tsc` がある場合、`_skip` を呼んだ後にフォールバックで `_pass`/`_fail` も呼ぶため SKIP と PASS/FAIL が同時カウントされる。出力にも矛盾した SKIP メッセージが残る |
| 8 | LOW | 可読性 | src/lib/db.ts:40-43, 52-59 | 戻り値の型注釈をインラインで毎回繰り返している（`{ id: number; content: string; created_at: string }[]`）。`type Announcement`/`type Checkin` として共有すると DRY |
| 9 | LOW | 命名/一貫性 | src/lib/db.ts:21 vs todayJst | `announcements.created_at` は SQLite `datetime('now')`（UTC）だが、サービス全体が JST 基準。表示時に UTC/JST が混在しうる。少なくとも保存時に JST へ正規化すべき |
| 10 | LOW | 保守性 | src/lib/db.ts:62-68 | `INSERT OR REPLACE` は重複チェックインに対し AUTOINCREMENT の新 id を発行する（行を削除→再挿入）。`INSERT ... ON CONFLICT(discord_name) DO UPDATE SET date = ?` の方が意図に近い |
| 11 | LOW | 可読性/保守性 | src/components/StatusBoard.tsx:23-32 | `loadRef` と `onReloadRef` の二重リファレンス管理が冗長。`MainPage` 側で `useRef` を `StatusBoard` に渡し直接代入するか、状態を上に持ち上げて `onReload` コールバックを渡す方が単純 |
| 12 | LOW | UX | src/components/CheckinForm.tsx:36 | チェックイン/チェックアウト後の `message` が次の操作・タイピングで消えない。一定時間経過 or 入力変更で `setMessage("")` を入れる方が親切 |
| 13 | INFO | 保守性 | package.json | `lint` スクリプトと ESLint 設定が無く、verify.sh の `eslint` セクションは常に SKIP される。Next.js 公式の `eslint-config-next` を追加すると整合する |
| 14 | INFO | 命名/一貫性 | tsconfig.json:16 / src/components/StatusBoard.tsx | パスエイリアス `@/*` を設定済みだが、`page.tsx` 以外は相対 import（`./StatusBoard` 等）。混在は将来の grep 効率を下げる |

## ブロッキングな問題

CRITICAL は無いため、ポストパイプラインの停止条件には該当しない。ただし以下 3 件は本番運用前の修正を強く推奨する。

### #1 — `todayJst()` のホスト依存

```ts
return new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
).toISOString().slice(0, 10);
```

`toLocaleString` で得た JST 文字列を `new Date()` に渡すと、文字列はホストのローカル TZ として再解釈される。その結果を `toISOString()`（UTC）でスライスするため、結果がホスト TZ に依存する。

実証 (TZ=Pacific/Kiritimati, UTC+14):
- JST 2026-06-12 04:00 (UTC 2026-06-11 19:00) → `2026-06-11` を返す（期待: `2026-06-12`）

UTC・JST ホストでは偶然動くが、移行先（Railway, Fly.io のリージョン次第）や DST のあるホストで日付がずれる可能性がある。

推奨：
```ts
return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
// → "2026-06-12" (YYYY-MM-DD)
```
これはホスト TZ に依存せず、ISO 8601 形式の日付を返す。

### #2 — Discord 通知失敗時に API 全体が 500

`sendAnnouncement` は `await fetch(...)` のエラーを catch せず、レスポンスコードもチェックしない。announcement は既に DB に保存されている状態で API が 500 を返すと、クライアントが再送して二重投稿を起こしうる。

推奨：
- `try { await sendAnnouncement(...) } catch (err) { console.warn("discord notify failed", err); }`
- かつ `if (!res.ok) { ... }` をフェッチ側で追加

スペック「`DISCORD_WEBHOOK_URL` 未設定時はエラーにならない」と整合させるため、設定済みでも障害時はノーオペ扱いが妥当。

### #3 — Discord メンションインジェクション

認証なしの API なので、誰でも `@everyone` を含む投稿が可能。Discord は Webhook 経由の `@everyone` をデフォルトで実行する。

推奨：
```ts
body: JSON.stringify({
  content: `📢 ...`,
  allowed_mentions: { parse: [] },
}),
```
ロール/ユーザメンションも同様に抑止される。

## フォローアップ提案

- **#4** Next 15 への正式対応として `serverComponentsExternalPackages` → `serverExternalPackages` に置換。
- **#5** content / discord_name に長さ上限を設定（例: announcement 500 文字、name 80 文字）。Discord メッセージ自体の上限 2000 文字も意識する。
- **#6** リスクレジスタに「Webhook フラッディング」を追加し、最低限の IP/セッションベースのレート制御または投稿間隔の緩和を検討。
- **#7** verify.sh の tsc 分岐を以下に整理：
  ```sh
  TSC_BIN=""
  if command -v tsc &>/dev/null; then TSC_BIN="tsc";
  elif [ -f "node_modules/.bin/tsc" ]; then TSC_BIN="node_modules/.bin/tsc"; fi
  if [ -z "$TSC_BIN" ]; then _skip "tsc が見つからない"; else ... fi
  ```
- **#8** `type Announcement` / `type Checkin` を `src/lib/db.ts` でエクスポートし、API・コンポーネント間で共有。
- **#9** `created_at` 保存時に `datetime('now','+9 hours')` などで JST 化、または ISO 文字列をアプリ層で生成して保存。表示も `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })` で統一。
- **#10** UNIQUE 制約に対する `ON CONFLICT DO UPDATE` への変更。
- **#11** `StatusBoard` の二重リファレンスは、`StatusBoard` を `forwardRef` 化するか、`MainPage` で状態を保持して props で渡す形に簡素化。
- **#12** `CheckinForm` の name 変更時に `setMessage("")` を入れる。
- **#13** `package.json` に `"lint": "next lint"` と `eslint-config-next` を追加。
- **#14** import パスを `@/components/...` に統一。

## 確認済み項目

- [x] 不要な変更（無関係な変更は無い。verify.sh 4 本の `PASS=$((PASS + 1))` 形式は意図された `set -e` 安全化）
- [x] 命名の一貫性（snake_case の `discord_name`/`created_at` は SQLite カラム由来で適切。コンポーネント名は PascalCase で一貫）
- [x] 可読性（関数長は全て 30 行未満、深いネストなし）
- [x] タイポ・コピペミス（発見無し）
- [x] null 安全性（`?.()` でガード済。JSON パース失敗は未ハンドル — 別所見 #2 と関連）
- [x] デバッグコード（`console.log` 等の残骸無し、TODO/コメントアウトコード無し）
- [x] シークレット・認証情報（コードベース内にハードコードされた Webhook URL 等は無し。`.gitignore` に `.env.local` と `*.db` が含まれている）
- [x] 例外処理（不足あり — 所見 #2）
- [x] セキュリティ（React によるエスケープで XSS は問題なし、prepared statement で SQL インジェクションは無し、Discord メンション抑止が必要 — 所見 #3, #5, #6）
- [x] 保守性（タイムゾーン処理に問題 — 所見 #1）

## 判定

**修正後マージ**

理由:
- CRITICAL 所見は無く、ポストパイプライン停止条件には該当しない（`/verify`・`/test` には進めてよい）。
- ただし HIGH 3 件（TZ 移植性、Discord 失敗時のエラー伝播、`@everyone` 抑止）はいずれもセルフホスト本番デプロイ前に修正したほうがよい。特に #3 は外部攻撃面（無認証 API → サーバ全員メンション）として最も低コストで悪用可能。
- verify.sh の所見 #7 は機能影響軽微だが、報告される PASS/FAIL/SKIP の信頼性が下がるため次の cycle で同梱修正を推奨。
