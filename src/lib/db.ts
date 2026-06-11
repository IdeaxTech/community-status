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
      date TEXT NOT NULL
    );
  `);
}

function todayJst(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  )
    .toISOString()
    .slice(0, 10);
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

export function getCheckins(): { discord_name: string }[] {
  const today = todayJst();
  getDb()
    .prepare("DELETE FROM checkins WHERE date != ?")
    .run(today);
  return getDb()
    .prepare("SELECT discord_name FROM checkins WHERE date = ?")
    .all(today) as { discord_name: string }[];
}

export function addCheckin(discordName: string): void {
  const today = todayJst();
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO checkins (discord_name, date) VALUES (?, ?)"
    )
    .run(discordName, today);
}

export function removeCheckin(discordName: string): void {
  getDb()
    .prepare("DELETE FROM checkins WHERE discord_name = ?")
    .run(discordName);
}
