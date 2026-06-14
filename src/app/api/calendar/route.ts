import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, addCalendarEvent } from "@/lib/db";

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
  const body = await req.json() as { date?: unknown; title?: unknown };
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
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
  addCalendarEvent(date, title);
  return NextResponse.json({ ok: true });
}
