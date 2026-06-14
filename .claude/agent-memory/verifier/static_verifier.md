---
name: Static verifier entry point
description: How to run static-only verification without triggering tests
type: reference
---

`./scripts/run-static-verify.sh` is the verifier's canonical entry point. It is a thin wrapper that exports `HARNESS_VERIFY_MODE=static` and delegates to `./scripts/run-verify.sh`.

`run-verify.sh` writes evidence to `docs/evidence/verify-<UTC-timestamp>.log` and an exit code to `.harness/state/verify-exit-code` (cleaned up on success). It auto-detects language packs via `./scripts/detect-languages.sh` and runs `packs/languages/<lang>/verify.sh` for each.

For TypeScript projects, the typescript pack runs `tsc --noEmit`, and skips eslint/prettier if not installed (output prints `[SKIP]` not `[FAIL]`).

**Do not run** `./scripts/run-test.sh` or `vitest` from the verifier role — that is the tester's responsibility.
