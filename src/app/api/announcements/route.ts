import { NextRequest, NextResponse } from "next/server";
import { getAnnouncements, addAnnouncement, getCheckins } from "@/lib/db";
import { sendAnnouncement } from "@/lib/discord";

export function GET(): NextResponse {
  return NextResponse.json(getAnnouncements());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  addAnnouncement(content);
  const count = getCheckins().length;
  // Fire-and-forget: Discord failure must not roll back or error the API response
  void sendAnnouncement(content, count).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
