import { NextResponse } from "next/server";
import { getCheckins } from "@/lib/db";

export function GET(): NextResponse {
  const checkins = getCheckins();
  return NextResponse.json({
    count: checkins.length,
    names: checkins.map((c) => c.discord_name),
  });
}
