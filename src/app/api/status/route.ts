import { NextResponse } from "next/server";
import { getCheckins } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const checkins = await getCheckins();
  return NextResponse.json({
    count: checkins.length,
    attendees: checkins.map((c) => ({ name: c.discord_name, status: c.status })),
    names: checkins.map((c) => c.discord_name),
  });
}
