export async function sendAnnouncement(
  content: string,
  attendeeCount: number
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `📢 **会場状況のお知らせ**\n${content}\n\n現在の参加人数: **${attendeeCount}人**`,
    }),
  });
}
