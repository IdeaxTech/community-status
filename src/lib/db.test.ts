import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Helper: make a fresh per-test sqlite path, set DB_PATH env, then re-import the
// db module so it picks up the new path and resets its module-level connection.
async function loadFreshDb(): Promise<typeof import("./db")> {
  vi.resetModules();
  return await import("./db");
}

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-db-"));
  dbPath = path.join(tmpDir, "test.db");
  process.env.DB_PATH = dbPath;
});

afterEach(() => {
  delete process.env.DB_PATH;
  // Clean up the temp DB and WAL/SHM siblings.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
  vi.useRealTimers();
});

describe("announcements CRUD", () => {
  it("returns empty array when no announcements exist", async () => {
    const db = await loadFreshDb();
    expect(db.getAnnouncements()).toEqual([]);
  });

  it("addAnnouncement persists and getAnnouncements returns newest-first", async () => {
    const db = await loadFreshDb();
    db.addAnnouncement("first");
    db.addAnnouncement("second");
    const rows = db.getAnnouncements();
    expect(rows).toHaveLength(2);
    expect(rows[0].content).toBe("second");
    expect(rows[1].content).toBe("first");
    expect(typeof rows[0].id).toBe("number");
    expect(typeof rows[0].created_at).toBe("string");
  });

  it("preserves special characters in content", async () => {
    const db = await loadFreshDb();
    const content = "テスト 🎉 <script>alert('x')</script> \"quoted\" 'single'";
    db.addAnnouncement(content);
    expect(db.getAnnouncements()[0].content).toBe(content);
  });
});

describe("checkins CRUD", () => {
  it("returns empty when no check-ins exist", async () => {
    const db = await loadFreshDb();
    expect(db.getCheckins()).toEqual([]);
  });

  it("addCheckin then getCheckins returns the name", async () => {
    const db = await loadFreshDb();
    db.addCheckin("alice#1234");
    const names = db.getCheckins().map((c) => c.discord_name);
    expect(names).toEqual(["alice#1234"]);
  });

  it("duplicate addCheckin is idempotent (INSERT OR REPLACE on UNIQUE name)", async () => {
    const db = await loadFreshDb();
    db.addCheckin("alice");
    db.addCheckin("alice");
    db.addCheckin("alice");
    const rows = db.getCheckins();
    expect(rows).toHaveLength(1);
    expect(rows[0].discord_name).toBe("alice");
  });

  it("supports multiple distinct check-ins", async () => {
    const db = await loadFreshDb();
    db.addCheckin("alice");
    db.addCheckin("bob");
    db.addCheckin("carol");
    const names = db.getCheckins().map((c) => c.discord_name).sort();
    expect(names).toEqual(["alice", "bob", "carol"]);
  });

  it("removeCheckin deletes a single record", async () => {
    const db = await loadFreshDb();
    db.addCheckin("alice");
    db.addCheckin("bob");
    db.removeCheckin("alice");
    const names = db.getCheckins().map((c) => c.discord_name);
    expect(names).toEqual(["bob"]);
  });

  it("removeCheckin on non-existent name is a no-op", async () => {
    const db = await loadFreshDb();
    db.addCheckin("alice");
    db.removeCheckin("nobody");
    expect(db.getCheckins().map((c) => c.discord_name)).toEqual(["alice"]);
  });

  it("accepts Discord names with special characters", async () => {
    const db = await loadFreshDb();
    const names = [
      "user#1234",
      "日本語ユーザー",
      "name with spaces",
      "user.with.dots",
      "ユーザー🎉",
      "O'Brien",
      "<script>",
    ];
    for (const n of names) {
      db.addCheckin(n);
    }
    const stored = db.getCheckins().map((c) => c.discord_name).sort();
    expect(stored).toEqual([...names].sort());
  });
});

describe("date rollover (JST) check-in reset", () => {
  it("removes check-ins from a previous JST day on the next getCheckins call", async () => {
    const db = await loadFreshDb();

    // Freeze time to 2026-06-10 15:00 UTC == 2026-06-11 00:00 JST.
    // Insert today's check-ins.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T15:00:00Z"));
    db.addCheckin("alice");
    db.addCheckin("bob");
    expect(db.getCheckins().map((c) => c.discord_name).sort()).toEqual([
      "alice",
      "bob",
    ]);

    // Advance to next JST day: 2026-06-11 15:00 UTC == 2026-06-12 00:00 JST.
    vi.setSystemTime(new Date("2026-06-11T15:00:00Z"));
    expect(db.getCheckins()).toEqual([]);
  });

  it("uses Asia/Tokyo regardless of host TZ — same UTC moment yields different day depending on offset", async () => {
    const db = await loadFreshDb();
    vi.useFakeTimers();
    // 2026-06-11 14:59:59 UTC == 2026-06-11 23:59:59 JST (still 2026-06-11)
    vi.setSystemTime(new Date("2026-06-11T14:59:59Z"));
    db.addCheckin("alice");
    expect(db.getCheckins().map((c) => c.discord_name)).toEqual(["alice"]);

    // +1 second: 2026-06-11 15:00:00 UTC == 2026-06-12 00:00:00 JST → reset.
    vi.setSystemTime(new Date("2026-06-11T15:00:00Z"));
    expect(db.getCheckins()).toEqual([]);
  });

  it("only deletes stale rows; same-day rows survive a lazy sweep", async () => {
    const db = await loadFreshDb();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T03:00:00Z")); // 12:00 JST
    db.addCheckin("alice");

    // Same JST day, different UTC moment.
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z")); // 19:00 JST
    db.addCheckin("bob");

    const names = db.getCheckins().map((c) => c.discord_name).sort();
    expect(names).toEqual(["alice", "bob"]);
  });
});

describe("calendar_events CRUD", () => {
  it("returns empty array when no events exist for the month", async () => {
    const db = await loadFreshDb();
    expect(db.getCalendarEvents(2026, 6)).toEqual([]);
  });

  it("addCalendarEvent persists and getCalendarEvents returns the row", async () => {
    const db = await loadFreshDb();
    db.addCalendarEvent("2026-06-11", "もくもく会");
    const rows = db.getCalendarEvents(2026, 6);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-06-11");
    expect(rows[0].title).toBe("もくもく会");
    expect(typeof rows[0].id).toBe("number");
  });

  it("returns events sorted by date ASC then id ASC", async () => {
    const db = await loadFreshDb();
    // Insert out of order to verify ORDER BY.
    db.addCalendarEvent("2026-06-20", "later");
    db.addCalendarEvent("2026-06-01", "earlier");
    db.addCalendarEvent("2026-06-15", "middle-a");
    db.addCalendarEvent("2026-06-15", "middle-b");
    const rows = db.getCalendarEvents(2026, 6);
    expect(rows.map((r) => r.title)).toEqual([
      "earlier",
      "middle-a",
      "middle-b",
      "later",
    ]);
  });

  it("scopes results to the requested year+month (month boundary)", async () => {
    const db = await loadFreshDb();
    // Surround June 2026 with events in adjacent months.
    db.addCalendarEvent("2026-05-31", "May last");
    db.addCalendarEvent("2026-06-01", "June first");
    db.addCalendarEvent("2026-06-30", "June last");
    db.addCalendarEvent("2026-07-01", "July first");

    const june = db.getCalendarEvents(2026, 6);
    expect(june.map((r) => r.date)).toEqual(["2026-06-01", "2026-06-30"]);

    const may = db.getCalendarEvents(2026, 5);
    expect(may.map((r) => r.date)).toEqual(["2026-05-31"]);

    const july = db.getCalendarEvents(2026, 7);
    expect(july.map((r) => r.date)).toEqual(["2026-07-01"]);
  });

  it("pads single-digit months so e.g. month=6 does not match month=06 only — and never matches month=12", async () => {
    const db = await loadFreshDb();
    db.addCalendarEvent("2026-06-15", "June");
    db.addCalendarEvent("2026-12-15", "December");
    // A naive LIKE "2026-6-%" would either over-match (matching nothing here)
    // or accidentally match December if the prefix logic were "2026-1-%".
    // Confirm the zero-padded prefix is correctly applied.
    expect(db.getCalendarEvents(2026, 6).map((r) => r.title)).toEqual(["June"]);
    expect(db.getCalendarEvents(2026, 12).map((r) => r.title)).toEqual([
      "December",
    ]);
    expect(db.getCalendarEvents(2026, 1)).toEqual([]);
  });

  it("isolates by year (same month in different years)", async () => {
    const db = await loadFreshDb();
    db.addCalendarEvent("2025-06-15", "2025 event");
    db.addCalendarEvent("2026-06-15", "2026 event");
    expect(db.getCalendarEvents(2025, 6).map((r) => r.title)).toEqual([
      "2025 event",
    ]);
    expect(db.getCalendarEvents(2026, 6).map((r) => r.title)).toEqual([
      "2026 event",
    ]);
  });

  it("handles leap year February (2024-02-29 is queryable)", async () => {
    const db = await loadFreshDb();
    db.addCalendarEvent("2024-02-29", "leap day");
    db.addCalendarEvent("2024-02-01", "feb first");
    const rows = db.getCalendarEvents(2024, 2);
    expect(rows.map((r) => r.date)).toEqual(["2024-02-01", "2024-02-29"]);
  });

  it("preserves special characters in title", async () => {
    const db = await loadFreshDb();
    const title = "テスト 🎉 <script>alert('x')</script> \"quoted\" 'O\\'Brien'";
    db.addCalendarEvent("2026-06-11", title);
    expect(db.getCalendarEvents(2026, 6)[0].title).toBe(title);
  });

  it("allows multiple events on the same date", async () => {
    const db = await loadFreshDb();
    db.addCalendarEvent("2026-06-11", "first");
    db.addCalendarEvent("2026-06-11", "second");
    const rows = db.getCalendarEvents(2026, 6);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.title)).toEqual(["first", "second"]);
    // Distinct ids.
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});
