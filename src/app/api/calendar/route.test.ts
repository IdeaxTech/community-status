import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// NextRequest used by the GET handler — only `req.url` is accessed by the route,
// so we synthesise a minimal stub. For POST, only `req.json()` is used.
function makeGetRequest(query: Record<string, string>): import("next/server").NextRequest {
  const params = new URLSearchParams(query).toString();
  const url = `http://localhost/api/calendar${params ? `?${params}` : ""}`;
  return { url } as unknown as import("next/server").NextRequest;
}

function makePostRequest(body: unknown): import("next/server").NextRequest {
  return {
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-calendar-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
});

afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/calendar", () => {
  it("returns [] when no events exist for the requested month", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "6" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns events for the requested month", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-06-04", "もくもく会");
    addCalendarEvent("2026-06-11", "勉強会");

    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "6" }));
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { date: string; title: string }[];
    expect(rows.map((r) => `${r.date}:${r.title}`)).toEqual([
      "2026-06-04:もくもく会",
      "2026-06-11:勉強会",
    ]);
  });

  it("ignores events outside the requested month (month boundary)", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-05-31", "May");
    addCalendarEvent("2026-06-01", "June first");
    addCalendarEvent("2026-06-30", "June last");
    addCalendarEvent("2026-07-01", "July");

    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "6" }));
    const rows = (await res.json()) as { date: string }[];
    expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-30"]);
  });

  it("returns leap-day events when querying February of a leap year", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2024-02-29", "leap");
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2024", month: "2" }));
    const rows = (await res.json()) as { date: string; title: string }[];
    expect(rows).toEqual([
      expect.objectContaining({ date: "2024-02-29", title: "leap" }),
    ]);
  });

  it("400 when year is missing", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ month: "6" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "valid year and month are required",
    });
  });

  it("400 when month is missing", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026" }));
    expect(res.status).toBe(400);
  });

  it("400 when month is 0 (below range)", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "0" }));
    expect(res.status).toBe(400);
  });

  it("400 when month is 13 (above range)", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "13" }));
    expect(res.status).toBe(400);
  });

  it("400 when year is not numeric", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "abc", month: "6" }));
    expect(res.status).toBe(400);
  });

  it("400 when month is not numeric", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "xyz" }));
    expect(res.status).toBe(400);
  });

  it("accepts month=1 (lower boundary)", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("accepts month=12 (upper boundary)", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ year: "2026", month: "12" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/calendar", () => {
  it("happy path: persists the event and returns ok", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "2026-06-11", title: "もくもく会" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const rows = getCalendarEvents(2026, 6);
    expect(rows.map((r) => `${r.date}:${r.title}`)).toEqual([
      "2026-06-11:もくもく会",
    ]);
  });

  it("trims surrounding whitespace from title before persisting", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "2026-06-11", title: "   padded   " })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6).map((r) => r.title)).toEqual(["padded"]);
  });

  it("trims surrounding whitespace from date before validating", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "  2026-06-11  ", title: "hi" })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6).map((r) => r.date)).toEqual([
      "2026-06-11",
    ]);
  });

  it("truncates title to 100 chars (spam guard)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const huge = "a".repeat(250);
    const res = await POST(makePostRequest({ date: "2026-06-11", title: huge }));
    expect(res.status).toBe(200);
    const stored = getCalendarEvents(2026, 6)[0].title;
    expect(stored).toHaveLength(100);
    expect(stored).toBe("a".repeat(100));
  });

  it("400 on empty title", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostRequest({ date: "2026-06-11", title: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("400 on whitespace-only title", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026-06-11", title: "   \n\t  " })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("400 when title is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostRequest({ date: "2026-06-11" }));
    expect(res.status).toBe(400);
  });

  it("400 when title is the wrong type (number)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026-06-11", title: 42 })
    );
    expect(res.status).toBe(400);
  });

  it("400 on empty date", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostRequest({ date: "", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date must be YYYY-MM-DD" });
  });

  it("400 when date is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostRequest({ title: "hi" }));
    expect(res.status).toBe(400);
  });

  it("400 when date is the wrong shape", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026/06/11", title: "hi" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date must be YYYY-MM-DD" });
  });

  it("400 when date is a non-calendar date (2026-02-31)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026-02-31", title: "hi" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "date is not a valid calendar date",
    });
  });

  it("400 when date is Feb 29 in a non-leap year (2025-02-29)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2025-02-29", title: "hi" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "date is not a valid calendar date",
    });
  });

  it("400 when month is out of range (2026-13-01)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026-13-01", title: "hi" })
    );
    expect(res.status).toBe(400);
  });

  it("400 when day is out of range (2026-04-31, April only has 30 days)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePostRequest({ date: "2026-04-31", title: "hi" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "date is not a valid calendar date",
    });
  });

  it("accepts Feb 29 in a leap year (2024-02-29)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "2024-02-29", title: "leap" })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2024, 2).map((r) => r.date)).toEqual([
      "2024-02-29",
    ]);
  });

  it("accepts events on Thursdays at the start of a month (2026-06-04)", async () => {
    // 2026-06-04 is a Thursday — moku-moku会 of the first week of June.
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "2026-06-04", title: "first Thursday" })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6).map((r) => r.date)).toEqual([
      "2026-06-04",
    ]);
  });

  it("accepts events on Thursdays at the end of a month (2026-04-30)", async () => {
    // 2026-04-30 is a Thursday — moku-moku会 falling on the final day of April.
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(
      makePostRequest({ date: "2026-04-30", title: "last Thursday" })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 4).map((r) => r.date)).toEqual([
      "2026-04-30",
    ]);
  });

  it("preserves special characters in title (UTF-8, quotes, HTML)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const title = "🎉 <script>alert('x')</script> \"quoted\"";
    const res = await POST(
      makePostRequest({ date: "2026-06-11", title })
    );
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6)[0].title).toBe(title);
  });

  it("rejects empty body cleanly (title check fires first)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });
});
