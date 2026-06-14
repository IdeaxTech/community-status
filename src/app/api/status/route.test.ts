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
  it("returns zero count and empty attendees when no one is checked in", async () => {
    const { GET } = await import("./route");
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; attendees: unknown[]; names: string[] };
    expect(body.count).toBe(0);
    expect(body.attendees).toEqual([]);
    expect(body.names).toEqual([]);
  });

  it("returns attendees and count after check-ins", async () => {
    const { addCheckin } = await import("@/lib/db");
    addCheckin("alice");
    addCheckin("bob");
    addCheckin("carol");

    const { GET } = await import("./route");
    const body = (await GET().json()) as { count: number; attendees: { name: string; status: string }[]; names: string[] };
    expect(body.count).toBe(3);
    expect(body.attendees.map((a) => a.name).sort()).toEqual(["alice", "bob", "carol"]);
    expect(body.attendees.every((a) => a.status === "at_venue")).toBe(true);
    expect(body.names.sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("preserves special characters in returned names", async () => {
    const { addCheckin } = await import("@/lib/db");
    addCheckin("日本語ユーザー🎉");

    const { GET } = await import("./route");
    const body = (await GET().json()) as { count: number; attendees: { name: string }[]; names: string[] };
    expect(body.attendees[0]?.name).toBe("日本語ユーザー🎉");
    expect(body.names).toEqual(["日本語ユーザー🎉"]);
  });
});
