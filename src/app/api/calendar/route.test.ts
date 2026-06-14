import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeGetRequest(query: Record<string, string>): import("next/server").NextRequest {
  const params = new URLSearchParams(query).toString();
  const url = `http://localhost/api/calendar${params ? `?${params}` : ""}`;
  return { url } as unknown as import("next/server").NextRequest;
}

function makeRequest(body: unknown): import("next/server").NextRequest {
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

  it("returns events with time field", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-06-04", "もくもく会", "13:00");
    addCalendarEvent("2026-06-11", "勉強会");

    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2026", month: "6" })).json()) as {
      date: string; title: string; time: string | null;
    }[];
    expect(rows[0]).toEqual(expect.objectContaining({ date: "2026-06-04", title: "もくもく会", time: "13:00" }));
    expect(rows[1]).toEqual(expect.objectContaining({ date: "2026-06-11", title: "勉強会", time: null }));
  });

  it("orders events by time ASC within the same date (null first)", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "夜", "20:00");
    addCalendarEvent("2026-06-11", "朝", "09:00");
    addCalendarEvent("2026-06-11", "時間なし");

    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2026", month: "6" })).json()) as { title: string }[];
    expect(rows.map((r) => r.title)).toEqual(["時間なし", "朝", "夜"]);
  });

  it("ignores events outside the requested month (month boundary)", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-05-31", "May");
    addCalendarEvent("2026-06-01", "June first");
    addCalendarEvent("2026-06-30", "June last");
    addCalendarEvent("2026-07-01", "July");

    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2026", month: "6" })).json()) as { date: string }[];
    expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-30"]);
  });

  it("returns leap-day events when querying February of a leap year", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2024-02-29", "leap");
    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2024", month: "2" })).json()) as { date: string; title: string }[];
    expect(rows).toEqual([expect.objectContaining({ date: "2024-02-29", title: "leap" })]);
  });

  it("400 when year is missing", async () => {
    const { GET } = await import("./route");
    const res = GET(makeGetRequest({ month: "6" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "valid year and month are required" });
  });

  it("400 when month is missing", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026" })).status).toBe(400);
  });

  it("400 when month is 0 (below range)", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "0" })).status).toBe(400);
  });

  it("400 when month is 13 (above range)", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "13" })).status).toBe(400);
  });

  it("400 when year is not numeric", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "abc", month: "6" })).status).toBe(400);
  });

  it("400 when month is not numeric", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "xyz" })).status).toBe(400);
  });

  it("accepts month=1 (lower boundary)", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "1" })).status).toBe(200);
  });

  it("accepts month=12 (upper boundary)", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "12" })).status).toBe(200);
  });
});

describe("POST /api/calendar", () => {
  it("happy path: persists the event without time and returns ok", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "もくもく会" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const rows = getCalendarEvents(2026, 6);
    expect(rows[0]).toEqual(expect.objectContaining({ date: "2026-06-11", title: "もくもく会", time: null }));
  });

  it("happy path with time", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-06-11", title: "もくもく会", time: "13:00" }));
    expect(getCalendarEvents(2026, 6)[0].time).toBe("13:00");
  });

  it("trims surrounding whitespace from title before persisting", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-06-11", title: "   padded   " }));
    expect(getCalendarEvents(2026, 6)[0].title).toBe("padded");
  });

  it("trims surrounding whitespace from date before validating", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "  2026-06-11  ", title: "hi" }));
    expect(getCalendarEvents(2026, 6)[0].date).toBe("2026-06-11");
  });

  it("truncates title to 100 chars (spam guard)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-06-11", title: "a".repeat(250) }));
    expect(getCalendarEvents(2026, 6)[0].title).toHaveLength(100);
  });

  it("400 on empty title", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("400 on whitespace-only title", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "   \n\t  " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("400 when title is missing", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-06-11" }))).status).toBe(400);
  });

  it("400 when title is the wrong type (number)", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-06-11", title: 42 }))).status).toBe(400);
  });

  it("400 on empty date", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date must be YYYY-MM-DD" });
  });

  it("400 when date is missing", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ title: "hi" }))).status).toBe(400);
  });

  it("400 when date is the wrong shape", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026/06/11", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date must be YYYY-MM-DD" });
  });

  it("400 when date is a non-calendar date (2026-02-31)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-02-31", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date is not a valid calendar date" });
  });

  it("400 when date is Feb 29 in a non-leap year (2025-02-29)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2025-02-29", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date is not a valid calendar date" });
  });

  it("400 when month is out of range (2026-13-01)", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-13-01", title: "hi" }))).status).toBe(400);
  });

  it("400 when day is out of range (2026-04-31)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-04-31", title: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date is not a valid calendar date" });
  });

  it("400 on invalid time format (no colon)", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-06-11", title: "hi", time: "1300" }))).status).toBe(400);
  });

  it("400 on out-of-range time (25:00)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "hi", time: "25:00" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "time must be HH:MM" });
  });

  it("400 on out-of-range minutes (00:99)", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-06-11", title: "hi", time: "00:99" }))).status).toBe(400);
  });

  it("accepts Feb 29 in a leap year (2024-02-29)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2024-02-29", title: "leap" }));
    expect(getCalendarEvents(2024, 2)[0].date).toBe("2024-02-29");
  });

  it("accepts events on Thursdays at the start of a month (2026-06-04)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-06-04", title: "first Thursday" }));
    expect(getCalendarEvents(2026, 6)[0].date).toBe("2026-06-04");
  });

  it("accepts events on Thursdays at the end of a month (2026-04-30)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-04-30", title: "last Thursday" }));
    expect(getCalendarEvents(2026, 4)[0].date).toBe("2026-04-30");
  });

  it("preserves special characters in title (UTF-8, quotes, HTML)", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const title = "🎉 <script>alert('x')</script> \"quoted\"";
    await POST(makeRequest({ date: "2026-06-11", title }));
    expect(getCalendarEvents(2026, 6)[0].title).toBe(title);
  });

  it("rejects empty body cleanly (title check fires first)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });
});

describe("PUT /api/calendar", () => {
  it("updates title and time", async () => {
    const { addCalendarEvent, getCalendarEvents } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "元のタイトル");
    const id = getCalendarEvents(2026, 6)[0].id;

    const { PUT } = await import("./route");
    const res = await PUT(makeRequest({ id, title: "新タイトル", time: "15:00" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const updated = getCalendarEvents(2026, 6)[0];
    expect(updated.title).toBe("新タイトル");
    expect(updated.time).toBe("15:00");
  });

  it("clears time when omitted", async () => {
    const { addCalendarEvent, getCalendarEvents } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "イベント", "13:00");
    const id = getCalendarEvents(2026, 6)[0].id;

    const { PUT } = await import("./route");
    await PUT(makeRequest({ id, title: "イベント" }));
    expect(getCalendarEvents(2026, 6)[0].time).toBeNull();
  });

  it("404 when id does not exist", async () => {
    const { PUT } = await import("./route");
    const res = await PUT(makeRequest({ id: 9999, title: "x" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "event not found" });
  });

  it("400 when id is missing", async () => {
    const { PUT } = await import("./route");
    expect((await PUT(makeRequest({ title: "x" }))).status).toBe(400);
  });

  it("400 when id is 0 (non-positive)", async () => {
    const { PUT } = await import("./route");
    expect((await PUT(makeRequest({ id: 0, title: "x" }))).status).toBe(400);
  });

  it("400 on empty title", async () => {
    const { PUT } = await import("./route");
    expect((await PUT(makeRequest({ id: 1, title: "" }))).status).toBe(400);
  });

  it("400 on invalid time format", async () => {
    const { PUT } = await import("./route");
    const res = await PUT(makeRequest({ id: 1, title: "x", time: "bad" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "time must be HH:MM" });
  });

  it("400 on out-of-range time (25:00)", async () => {
    const { PUT } = await import("./route");
    expect((await PUT(makeRequest({ id: 1, title: "x", time: "25:00" }))).status).toBe(400);
  });
});

describe("DELETE /api/calendar", () => {
  it("deletes an event by id", async () => {
    const { addCalendarEvent, getCalendarEvents } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "消えるイベント");
    const id = getCalendarEvents(2026, 6)[0].id;

    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({ id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getCalendarEvents(2026, 6)).toHaveLength(0);
  });

  it("only deletes the targeted event, not others on the same date", async () => {
    const { addCalendarEvent, getCalendarEvents } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "消える");
    addCalendarEvent("2026-06-11", "残る");
    const id = getCalendarEvents(2026, 6)[0].id;

    const { DELETE } = await import("./route");
    await DELETE(makeRequest({ id }));
    const remaining = getCalendarEvents(2026, 6);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe("残る");
  });

  it("404 when id does not exist", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({ id: 9999 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "event not found" });
  });

  it("400 when id is missing", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(makeRequest({}))).status).toBe(400);
  });

  it("400 when id is 0 (non-positive)", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(makeRequest({ id: 0 }))).status).toBe(400);
  });

  it("400 when id is negative", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(makeRequest({ id: -1 }))).status).toBe(400);
  });

  it("400 when id is a string", async () => {
    const { DELETE } = await import("./route");
    expect((await DELETE(makeRequest({ id: "1" }))).status).toBe(400);
  });
});
