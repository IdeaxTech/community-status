import { NextRequest, NextResponse } from "next/server";
import { addCheckin, removeCheckin, type CheckinStatus } from "@/lib/db";

const VALID_STATUSES: CheckinStatus[] = ["at_venue", "on_the_way"];

function isCheckinStatus(v: unknown): v is CheckinStatus {
  return VALID_STATUSES.includes(v as CheckinStatus);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { discord_name?: unknown; status?: unknown };
  const name = typeof body.discord_name === "string" ? body.discord_name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "discord_name is required" }, { status: 400 });
  }
  const status: CheckinStatus = isCheckinStatus(body.status) ? body.status : "at_venue";
  addCheckin(name, status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { discord_name?: unknown };
  const name = typeof body.discord_name === "string" ? body.discord_name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "discord_name is required" }, { status: 400 });
  }
  removeCheckin(name);
  return NextResponse.json({ ok: true });
}
