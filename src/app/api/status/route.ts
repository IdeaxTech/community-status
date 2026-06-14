import { NextResponse } from "next/server";
import { getCheckins, type CheckinStatus } from "@/lib/db";

export function GET(): NextResponse {
  const checkins = getCheckins();
  return NextResponse.json({
    count: checkins.length,
    attendees: checkins.map((c) => ({ name: c.discord_name, status: c.status })),
    // Keep backward-compat field
    names: checkins.map((c) => c.discord_name),
  });
}
