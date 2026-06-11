import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  // Reset only the keys we mutate; leave the rest alone.
  delete process.env.DISCORD_WEBHOOK_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendAnnouncement", () => {
  it("is a no-op when DISCORD_WEBHOOK_URL is unset", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendAnnouncement } = await import("./discord");
    await expect(sendAnnouncement("hello", 3)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when DISCORD_WEBHOOK_URL is the empty string", async () => {
    process.env.DISCORD_WEBHOOK_URL = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendAnnouncement } = await import("./discord");
    await sendAnnouncement("hello", 3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to the webhook with content, attendee count, and allowed_mentions guard when configured", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendAnnouncement } = await import("./discord");
    await sendAnnouncement("会場OK", 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.example/webhook");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as {
      content: string;
      allowed_mentions: { parse: string[] };
    };
    expect(body.content).toContain("会場OK");
    expect(body.content).toContain("5人");
    // Mention-suppression guard: parse must be empty so @everyone/@here are inert.
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("includes special characters verbatim in the posted content", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendAnnouncement } = await import("./discord");
    const tricky = "改行\nタブ\t絵文字🚀 \"引用\" 'シングル' <html>";
    await sendAnnouncement(tricky, 1);

    const body = JSON.parse(
      fetchMock.mock.calls[0][1].body as string
    ) as { content: string };
    expect(body.content).toContain(tricky);
  });
});
