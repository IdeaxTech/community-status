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
