import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-status-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
});

afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/status", () => {
  it("returns zero count and empty names when no one is checked in", async () => {
    const { GET } = await import("./route");
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, names: [] });
  });

  it("returns names and count after check-ins", async () => {
    const { addCheckin } = await import("@/lib/db");
    addCheckin("alice");
    addCheckin("bob");
    addCheckin("carol");

    const { GET } = await import("./route");
    const body = (await GET().json()) as { count: number; names: string[] };
    expect(body.count).toBe(3);
    expect(body.names.sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("preserves special characters in returned names", async () => {
    const { addCheckin } = await import("@/lib/db");
    addCheckin("日本語ユーザー🎉");

    const { GET } = await import("./route");
    const body = (await GET().json()) as { count: number; names: string[] };
    expect(body.names).toEqual(["日本語ユーザー🎉"]);
  });
});
