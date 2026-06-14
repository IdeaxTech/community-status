import { NextResponse } from "next/server";
import { getCheckins, getTodayAnnouncements } from "@/lib/db";

const VENUE = "タワー五階 M-Studio";
const DISCORD_CHANNEL = "#もくもく会";
const SESSION_START_H = 13;
const SESSION_END_H = 20;
const THURSDAY = 4;

function nowJst(): { day: number; hour: number; minute: number; label: string } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const h = now.getHours();
  const m = now.getMinutes();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const label = `${month}/${date}（木）${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { day: now.getDay(), hour: h, minute: m, label };
}

function isSessionTime(day: number, hour: number): boolean {
  return day === THURSDAY && hour >= SESSION_START_H && hour < SESSION_END_H;
}

export async function POST(req: Request): Promise<NextResponse> {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "DISCORD_WEBHOOK_URL not set" }, { status: 500 });
  }

  const { day, hour, minute, label } = nowJst();

  if (!isSessionTime(day, hour)) {
    return NextResponse.json({ skipped: true, reason: "outside session hours" });
  }

  const checkins = getCheckins();
  const announcements = getTodayAnnouncements();

  // Attendee field
  const atVenue = checkins.filter((c) => c.status === "at_venue");
  const onTheWay = checkins.filter((c) => c.status === "on_the_way");

  const attendeeLines: string[] = [
    ...atVenue.map((c) => `🏠 ${c.discord_name}`),
    ...onTheWay.map((c) => `🚶 ${c.discord_name}`),
  ];
  const attendeeValue =
    checkins.length === 0
      ? "まだ誰もいません"
      : attendeeLines.join("\n");

  // Announcement field
  const announcementValue =
    announcements.length === 0
      ? "特になし"
      : announcements.map((a) => `• ${a.content}`).join("\n");

  // Next notification time label
  const nextMin = minute < 30 ? 30 : 0;
  const nextHour = minute < 30 ? hour : hour + 1;
  const nextLabel =
    nextHour < SESSION_END_H
      ? `次回: ${String(nextHour).padStart(2, "0")}:${String(nextMin).padStart(2, "0")}`
      : "本日の定期通知はこれで終了";

  const embed = {
    title: `🏠 もくもく会 現地状況 — ${label}`,
    color: 0xf97316,
    fields: [
      {
        name: `👥 参加中 ${checkins.length}人（在席 ${atVenue.length}人 / 移動中 ${onTheWay.length}人）`,
        value: attendeeValue,
        inline: false,
      },
      {
        name: "📢 会場からのお知らせ",
        value: announcementValue,
        inline: false,
      },
    ],
    footer: {
      text: `${VENUE} | ${DISCORD_CHANNEL} | ${nextLabel}`,
    },
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Discord webhook failed", detail: text }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: label });
}
