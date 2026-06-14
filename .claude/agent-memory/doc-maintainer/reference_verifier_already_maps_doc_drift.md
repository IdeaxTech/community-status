---
name: verifier reports already enumerate the doc-drift list
description: the latest verify-*.md often lists exact files/lines for /sync-docs to fix
type: reference
---

`/verify` の所見テーブル（`docs/reports/verify-*.md`）には、深刻度 LOW でも `**/sync-docs の範囲**` というタグ付きで、具体的なファイル・行番号・更新後の文言が書かれていることが多い。`/sync-docs` を実行する際はまずそこを読むと作業範囲が確定できる。

**How to apply:** `/sync-docs` 開始時に `ls docs/reports/verify-*.md` で最新を確認し、所見テーブルの `**/sync-docs の範囲**` 行を作業リストにする。verifier 側にも対応するメモリ（`.claude/agent-memory/verifier/blind_spot_env_var_renames.md`）がある。
