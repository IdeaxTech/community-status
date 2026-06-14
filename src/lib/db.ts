import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(process.cwd(), "data.db")}`;
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

async function initSchema(): Promise<void> {
  const db = getClient();
  await db.executeMultiple(`
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
  for (const sql of [
    "ALTER TABLE checkins ADD COLUMN status TEXT NOT NULL DEFAULT 'at_venue'",
    "ALTER TABLE calendar_events ADD COLUMN time TEXT",
  ]) {
    try { await db.execute(sql); } catch { /* already exists */ }
  }
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((err) => {
      schemaReady = null; // allow retry on next call
      throw err;
    });
  }
  return schemaReady;
}

function todayJst(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type CheckinStatus = "at_venue" | "on_the_way";

export async function getAnnouncements(): Promise<{ id: number; content: string; created_at: string }[]> {
  await ensureSchema();
  const r = await getClient().execute(
    "SELECT id, content, created_at FROM announcements ORDER BY id DESC"
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    content: String(row.content),
    created_at: String(row.created_at),
  }));
}

export async function getTodayAnnouncements(): Promise<{ id: number; content: string; created_at: string }[]> {
  await ensureSchema();
  const today = todayJst();
  const r = await getClient().execute({
    sql: "SELECT id, content, created_at FROM announcements WHERE date(created_at, '+9 hours') = ? ORDER BY id ASC",
    args: [today],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    content: String(row.content),
    created_at: String(row.created_at),
  }));
}

export async function addAnnouncement(content: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({ sql: "INSERT INTO announcements (content) VALUES (?)", args: [content] });
}

export async function getCheckins(): Promise<{ discord_name: string; status: CheckinStatus }[]> {
  await ensureSchema();
  const today = todayJst();
  const db = getClient();
  await db.execute({ sql: "DELETE FROM checkins WHERE date != ?", args: [today] });
  const r = await db.execute({
    sql: "SELECT discord_name, status FROM checkins WHERE date = ? ORDER BY id ASC",
    args: [today],
  });
  return r.rows.map((row) => ({
    discord_name: String(row.discord_name),
    status: String(row.status) as CheckinStatus,
  }));
}

export async function addCheckin(discordName: string, status: CheckinStatus = "at_venue"): Promise<void> {
  await ensureSchema();
  const today = todayJst();
  await getClient().execute({
    sql: "INSERT OR REPLACE INTO checkins (discord_name, date, status) VALUES (?, ?, ?)",
    args: [discordName, today, status],
  });
}

export async function removeCheckin(discordName: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({ sql: "DELETE FROM checkins WHERE discord_name = ?", args: [discordName] });
}

export async function getCalendarEvents(
  year: number,
  month: number
): Promise<{ id: number; date: string; title: string; time: string | null }[]> {
  await ensureSchema();
  const prefix = `${String(year)}-${String(month).padStart(2, "0")}`;
  const r = await getClient().execute({
    sql: "SELECT id, date, title, time FROM calendar_events WHERE date LIKE ? ORDER BY date ASC, time ASC, id ASC",
    args: [`${prefix}-%`],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    date: String(row.date),
    title: String(row.title),
    time: row.time != null ? String(row.time) : null,
  }));
}

export async function addCalendarEvent(date: string, title: string, time?: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "INSERT INTO calendar_events (date, title, time) VALUES (?, ?, ?)",
    args: [date, title, time ?? null],
  });
}

export async function updateCalendarEvent(id: number, title: string, time: string | null): Promise<boolean> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: "UPDATE calendar_events SET title = ?, time = ? WHERE id = ?",
    args: [title, time, id],
  });
  return (r.rowsAffected ?? 0) > 0;
}

export async function deleteCalendarEvent(id: number): Promise<boolean> {
  await ensureSchema();
  const r = await getClient().execute({
    sql: "DELETE FROM calendar_events WHERE id = ?",
    args: [id],
  });
  return (r.rowsAffected ?? 0) > 0;
}
