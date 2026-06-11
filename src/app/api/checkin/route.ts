import { NextRequest, NextResponse } from "next/server";
import { addCheckin, removeCheckin } from "@/lib/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { discord_name?: unknown };
  const name = typeof body.discord_name === "string" ? body.discord_name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "discord_name is required" }, { status: 400 });
  }
  addCheckin(name);
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
