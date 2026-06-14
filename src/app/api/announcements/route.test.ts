import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeRequest(body: unknown): import("next/server").NextRequest {
  return {
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-ann-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  delete process.env.DISCORD_WEBHOOK_URL;
});

afterEach(() => {
  delete process.env.DB_PATH;
  delete process.env.DISCORD_WEBHOOK_URL;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/announcements", () => {
  it("returns [] when none exist", async () => {
    const { GET } = await import("./route");
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns announcements newest-first", async () => {
    const { addAnnouncement } = await import("@/lib/db");
    addAnnouncement("first");
    addAnnouncement("second");
    const { GET } = await import("./route");
    const rows = (await GET().json()) as { content: string }[];
    expect(rows.map((r) => r.content)).toEqual(["second", "first"]);
  });
});

describe("POST /api/announcements", () => {
  it("happy path persists content and returns ok", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const { getAnnouncements } = await import("@/lib/db");

    const res = await POST(makeRequest({ content: "会場OK" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getAnnouncements().map((a) => a.content)).toEqual(["会場OK"]);
  });

  it("400 on empty content", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ content: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "content is required" });
  });

  it("400 on whitespace-only content", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ content: "   \n\t  " }));
    expect(res.status).toBe(400);
  });

  it("400 when content missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400 on wrong-type content", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ content: 42 }));
    expect(res.status).toBe(400);
  });

  it("trims content before persisting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const { getAnnouncements } = await import("@/lib/db");
    await POST(makeRequest({ content: "  trimmed  " }));
    expect(getAnnouncements().map((a) => a.content)).toEqual(["trimmed"]);
  });

  it("does NOT call fetch when DISCORD_WEBHOOK_URL is unset", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ content: "no webhook configured" }));
    expect(res.status).toBe(200);
    // sendAnnouncement is fire-and-forget but synchronous up to fetch dispatch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Discord webhook with content + attendee count when configured", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { addCheckin } = await import("@/lib/db");
    addCheckin("alice");
    addCheckin("bob");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ content: "本日は開催します" }));
    expect(res.status).toBe(200);

    // Allow the fire-and-forget microtask to flush.
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.example/webhook");
    const body = JSON.parse(init.body as string) as {
      content: string;
      allowed_mentions: { parse: string[] };
    };
    expect(body.content).toContain("本日は開催します");
    expect(body.content).toContain("2人");
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("API call still succeeds (200) when Discord fetch throws", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const { getAnnouncements } = await import("@/lib/db");

    const res = await POST(makeRequest({ content: "with broken webhook" }));
    // The route is fire-and-forget with a .catch(() => undefined) — so the
    // rejected fetch must not bubble up to the caller.
    expect(res.status).toBe(200);
    expect(getAnnouncements().map((a) => a.content)).toEqual([
      "with broken webhook",
    ]);
    await new Promise((r) => setImmediate(r));
  });
});
