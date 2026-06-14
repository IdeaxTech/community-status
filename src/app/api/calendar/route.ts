import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/db";

const TIME_RE = /^\d{2}:\d{2}$/;

function parseTime(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  return v;
}

function isValidTime(v: string | null): boolean {
  return v === null || TIME_RE.test(v);
}

export function GET(req: NextRequest): NextResponse {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "valid year and month are required" }, { status: 400 });
  }
  return NextResponse.json(getCalendarEvents(year, month));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { date?: unknown; title?: unknown; time?: unknown };
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const time = parseTime(body.time);
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return NextResponse.json({ error: "date is not a valid calendar date" }, { status: 400 });
  }
  if (!isValidTime(time)) {
    return NextResponse.json({ error: "time must be HH:MM" }, { status: 400 });
  }
  addCalendarEvent(date, title, time ?? undefined);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { id?: unknown; title?: unknown; time?: unknown };
  const id = typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0 ? body.id : null;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const time = parseTime(body.time);
  if (id === null) {
    return NextResponse.json({ error: "valid id is required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!isValidTime(time)) {
    return NextResponse.json({ error: "time must be HH:MM" }, { status: 400 });
  }
  const updated = updateCalendarEvent(id, title, time);
  if (!updated) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { id?: unknown };
  const id = typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0 ? body.id : null;
  if (id === null) {
    return NextResponse.json({ error: "valid id is required" }, { status: 400 });
  }
  const deleted = deleteCalendarEvent(id);
  if (!deleted) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
