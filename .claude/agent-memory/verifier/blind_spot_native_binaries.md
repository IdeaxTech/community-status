---
name: Native binary externalization is invisible to tsc
description: When DB/native deps are swapped, check next.config.ts serverExternalPackages
type: feedback
---

When a native-binary dependency is swapped (e.g., `better-sqlite3` → `@libsql/client`), `tsc --noEmit` will pass even if `next.config.ts` `serverExternalPackages` still references the old package. The misconfig surfaces only at `next build` or runtime.

**Why:** Native `.node` binaries (e.g., `@libsql/darwin-arm64/index.node`) must be externalized from the Next.js server bundle. If `serverExternalPackages` lists the wrong package, the bundler may try to inline the binary, causing runtime resolution errors. The TypeScript compiler has no visibility into this config.

**How to apply:** During verification of any dependency swap that involves native code, grep `next.config.ts`, `next.config.js`, `vite.config.*`, `webpack.config.*` for the *old* package name and flag any hit as HIGH severity even if static checks pass. Recommend a `npm run build` smoke test before declaring conditional pass.
