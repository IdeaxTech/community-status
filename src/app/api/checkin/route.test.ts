import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Build a NextRequest-compatible object for the route handlers. The handlers
// only call req.json(), so a minimal stub is sufficient.
function makeRequest(body: unknown): import("next/server").NextRequest {
  return {
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-checkin-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
});

afterEach(() => {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("POST /api/checkin", () => {
  it("happy path: creates a check-in for a valid name", async () => {
    const { POST } = await import("./route");
    const { getCheckins } = await import("@/lib/db");
    const res = await POST(makeRequest({ discord_name: "alice" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await getCheckins()).map((c) => c.discord_name)).toEqual(["alice"]);
  });

  it("trims surrounding whitespace before persisting", async () => {
    const { POST } = await import("./route");
    const { getCheckins } = await import("@/lib/db");
    const res = await POST(makeRequest({ discord_name: "  alice  " }));
    expect(res.status).toBe(200);
    expect((await getCheckins()).map((c) => c.discord_name)).toEqual(["alice"]);
  });

  it("400 on empty string", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ discord_name: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "discord_name is required" });
  });

  it("400 on whitespace-only string", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ discord_name: "   " }));
    expect(res.status).toBe(400);
  });

  it("400 when discord_name is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400 when discord_name is the wrong type (number)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ discord_name: 123 }));
    expect(res.status).toBe(400);
  });

  it("400 when discord_name is null", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ discord_name: null }));
    expect(res.status).toBe(400);
  });

  it("duplicate check-in is idempotent (no error, single row)", async () => {
    const { POST } = await import("./route");
    const { getCheckins } = await import("@/lib/db");
    await POST(makeRequest({ discord_name: "alice" }));
    const res = await POST(makeRequest({ discord_name: "alice" }));
    expect(res.status).toBe(200);
    expect((await getCheckins()).filter((c) => c.discord_name === "alice")).toHaveLength(1);
  });

  it("accepts Discord names with special characters", async () => {
    const { POST } = await import("./route");
    const { getCheckins } = await import("@/lib/db");
    await POST(makeRequest({ discord_name: "ユーザー🎉#1234" }));
    expect((await getCheckins()).map((c) => c.discord_name)).toEqual([
      "ユーザー🎉#1234",
    ]);
  });
});

describe("DELETE /api/checkin", () => {
  it("removes an existing check-in", async () => {
    const { POST, DELETE } = await import("./route");
    const { getCheckins } = await import("@/lib/db");
    await POST(makeRequest({ discord_name: "alice" }));
    const res = await DELETE(makeRequest({ discord_name: "alice" }));
    expect(res.status).toBe(200);
    expect(await getCheckins()).toEqual([]);
  });

  it("deleting a non-existent name is a no-op success", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({ discord_name: "ghost" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("400 on empty name", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({ discord_name: "" }));
    expect(res.status).toBe(400);
  });

  it("400 on missing field", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
