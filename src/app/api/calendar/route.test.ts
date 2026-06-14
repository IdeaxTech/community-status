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

  it("orders events by time ASC within the same date", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "夜", "20:00");
    addCalendarEvent("2026-06-11", "朝", "09:00");
    addCalendarEvent("2026-06-11", "時間なし");

    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2026", month: "6" })).json()) as { title: string }[];
    expect(rows.map((r) => r.title)).toEqual(["時間なし", "朝", "夜"]);
  });

  it("ignores events outside the requested month", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2026-05-31", "May");
    addCalendarEvent("2026-06-01", "June first");
    addCalendarEvent("2026-06-30", "June last");
    addCalendarEvent("2026-07-01", "July");

    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2026", month: "6" })).json()) as { date: string }[];
    expect(rows.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-30"]);
  });

  it("returns leap-day events", async () => {
    const { addCalendarEvent } = await import("@/lib/db");
    addCalendarEvent("2024-02-29", "leap");
    const { GET } = await import("./route");
    const rows = (await GET(makeGetRequest({ year: "2024", month: "2" })).json()) as { date: string }[];
    expect(rows[0]).toEqual(expect.objectContaining({ date: "2024-02-29" }));
  });

  it("400 when year is missing", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ month: "6" })).status).toBe(400);
  });

  it("400 when month is 0", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "0" })).status).toBe(400);
  });

  it("400 when month is 13", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "13" })).status).toBe(400);
  });

  it("accepts month=1 and month=12", async () => {
    const { GET } = await import("./route");
    expect(GET(makeGetRequest({ year: "2026", month: "1" })).status).toBe(200);
    expect(GET(makeGetRequest({ year: "2026", month: "12" })).status).toBe(200);
  });
});

describe("POST /api/calendar", () => {
  it("happy path without time", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "もくもく会" }));
    expect(res.status).toBe(200);
    const rows = getCalendarEvents(2026, 6);
    expect(rows[0]).toEqual(expect.objectContaining({ title: "もくもく会", time: null }));
  });

  it("happy path with time", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "もくもく会", time: "13:00" }));
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6)[0].time).toBe("13:00");
  });

  it("400 on invalid time format", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ date: "2026-06-11", title: "hi", time: "1300" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "time must be HH:MM" });
  });

  it("trims title and truncates to 100 chars", async () => {
    const { POST } = await import("./route");
    const { getCalendarEvents } = await import("@/lib/db");
    await POST(makeRequest({ date: "2026-06-11", title: "   " + "a".repeat(200) }));
    expect(getCalendarEvents(2026, 6)[0].title).toHaveLength(100);
  });

  it("400 on empty title", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-06-11", title: "" }))).status).toBe(400);
  });

  it("400 on invalid date format", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026/06/11", title: "hi" }))).status).toBe(400);
  });

  it("400 on non-calendar date (2026-02-31)", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2026-02-31", title: "hi" }))).status).toBe(400);
  });

  it("accepts Feb 29 in leap year", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest({ date: "2024-02-29", title: "leap" }))).status).toBe(200);
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
});

describe("DELETE /api/calendar", () => {
  it("deletes an event by id", async () => {
    const { addCalendarEvent, getCalendarEvents } = await import("@/lib/db");
    addCalendarEvent("2026-06-11", "消えるイベント");
    const id = getCalendarEvents(2026, 6)[0].id;

    const { DELETE } = await import("./route");
    const res = await DELETE(makeRequest({ id }));
    expect(res.status).toBe(200);
    expect(getCalendarEvents(2026, 6)).toHaveLength(0);
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
