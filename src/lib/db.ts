import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_name TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'at_venue'
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migrate: add status column to existing checkins tables
  try {
    database.exec("ALTER TABLE checkins ADD COLUMN status TEXT NOT NULL DEFAULT 'at_venue'");
  } catch {
    // Column already exists — no-op
  }
  // Migrate: add time column to existing calendar_events tables
  try {
    database.exec("ALTER TABLE calendar_events ADD COLUMN time TEXT");
  } catch {
    // Column already exists — no-op
  }
}

function todayJst(): string {
  // Intl.DateTimeFormat gives JST date parts regardless of host TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getAnnouncements(): { id: number; content: string; created_at: string }[] {
  return getDb()
    .prepare("SELECT id, content, created_at FROM announcements ORDER BY id DESC")
    .all() as { id: number; content: string; created_at: string }[];
}

export function addAnnouncement(content: string): void {
  getDb()
    .prepare("INSERT INTO announcements (content) VALUES (?)")
    .run(content);
}

export type CheckinStatus = "at_venue" | "on_the_way";

export function getCheckins(): { discord_name: string; status: CheckinStatus }[] {
  const today = todayJst();
  getDb().prepare("DELETE FROM checkins WHERE date != ?").run(today);
  return getDb()
    .prepare("SELECT discord_name, status FROM checkins WHERE date = ? ORDER BY id ASC")
    .all(today) as { discord_name: string; status: CheckinStatus }[];
}

export function addCheckin(discordName: string, status: CheckinStatus = "at_venue"): void {
  const today = todayJst();
  getDb()
    .prepare("INSERT OR REPLACE INTO checkins (discord_name, date, status) VALUES (?, ?, ?)")
    .run(discordName, today, status);
}

export function removeCheckin(discordName: string): void {
  getDb()
    .prepare("DELETE FROM checkins WHERE discord_name = ?")
    .run(discordName);
}

export function getCalendarEvents(
  year: number,
  month: number
): { id: number; date: string; title: string; time: string | null }[] {
  const prefix = `${String(year)}-${String(month).padStart(2, "0")}`;
  return getDb()
    .prepare(
      "SELECT id, date, title, time FROM calendar_events WHERE date LIKE ? ORDER BY date ASC, time ASC, id ASC"
    )
    .all(`${prefix}-%`) as { id: number; date: string; title: string; time: string | null }[];
}

export function addCalendarEvent(date: string, title: string, time?: string): void {
  getDb()
    .prepare("INSERT INTO calendar_events (date, title, time) VALUES (?, ?, ?)")
    .run(date, title, time ?? null);
}

export function updateCalendarEvent(id: number, title: string, time: string | null): boolean {
  const result = getDb()
    .prepare("UPDATE calendar_events SET title = ?, time = ? WHERE id = ?")
    .run(title, time, id);
  return result.changes > 0;
}

export function deleteCalendarEvent(id: number): boolean {
  const result = getDb()
    .prepare("DELETE FROM calendar_events WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
