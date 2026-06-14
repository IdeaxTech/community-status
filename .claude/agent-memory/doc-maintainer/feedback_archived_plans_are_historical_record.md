---
name: archived plans are historical record
description: docs/plans/archive/** must not be rewritten during sync-docs even if it mentions deprecated tech
type: feedback
---

`docs/plans/archive/**` のプランは完了時点のスナップショットとして保持する。ライブラリやスタックが後から変わっても、その変更を遡って書き換えない。

**Why:** プランは「いつ・なぜ・何を前提に」その判断を下したかの履歴になっている。後の移行（例: 2026-06-14 の `better-sqlite3` → `@libsql/client`）を反映してアーカイブを書き換えると、past decision の文脈が消える。レポート（`docs/reports/**`）も同じ理由で凍結する。

**How to apply:** `/sync-docs` で stale reference を見つけたとき、その出現箇所が `docs/plans/archive/**` または `docs/reports/**` ならスキップする。更新対象は `README.md` / `CLAUDE.md` / `.claude/rules/**` / `.env.local.example` / config コメント / `docs/plans/active/**` / `docs/tech-debt/**` のみ。`docs/tech-debt/**` は「解消済み」へのステータス更新は OK。
