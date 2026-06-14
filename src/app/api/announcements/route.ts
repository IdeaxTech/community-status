import { NextRequest, NextResponse } from "next/server";
import { getAnnouncements, addAnnouncement, getCheckins } from "@/lib/db";
import { sendAnnouncement } from "@/lib/discord";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getAnnouncements());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
  await addAnnouncement(content);
  const checkins = await getCheckins();
  void sendAnnouncement(content, checkins.length).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
