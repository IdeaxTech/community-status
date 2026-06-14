---
name: Env var renames leak stale references into config and docs
description: When env vars are renamed, src/ greps miss config comments, .env.example, README
type: feedback
---

Env var renames (e.g., `DB_PATH` → `TURSO_DATABASE_URL`) tend to be applied carefully in `src/` but leave stale references in: `.env.local.example`, `vitest.config.ts` / `vite.config.ts` comments, `next.config.ts`, `README.md`, deploy docs, and CI workflows.

**Why:** Implementers grep `src/` to update code, then static checks pass because none of these auxiliary files affect type checks. Reviewers also focus on diff hunks, which usually contain only `src/`. The drift then manifests at deploy time or confuses the next maintainer.

**How to apply:** For any verification involving a renamed env var or contract change, run a repo-wide grep for the *old* name with `!node_modules` and explicitly check: `.env*.example`, `vitest.config.*`, `next.config.*`, `README.md`, `docs/**`, `.github/**`. Stale comments are LOW severity (sync-docs scope); stale config that affects runtime is HIGH.
