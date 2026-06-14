"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: number;
  content: string;
  created_at: string;
}

export function AnnouncementForm({ onPost }: { onPost?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  async function loadAnnouncements() {
    const res = await fetch("/api/announcements");
    const json = (await res.json()) as Announcement[];
    setAnnouncements(json);
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    setContent("");
    setLoading(false);
    onPost?.();
    await loadAnnouncements();
  }

  return (
    <div className="card p-6 space-y-4">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">会場状況のお知らせ</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          placeholder="例: 今日は隣のイベントで少し狭いです"
          className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors duration-150
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          style={{ background: "var(--glass)", borderColor: "var(--glass-border)", color: "var(--text)" }}
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || !content.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white
            hover:bg-orange-400 active:bg-orange-600 disabled:opacity-40 transition-colors duration-150 cursor-pointer"
        >
          投稿
        </button>
      </div>

      {announcements.length > 0 ? (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-0.5 py-2 px-3 rounded-lg border-l-2 border-orange-500/60"
              style={{ background: "var(--glass)", borderColor: "var(--glass-border)" }}
            >
              <span className="text-xs text-muted">{a.created_at}</span>
              <p className="text-sm" style={{ color: "var(--text)" }}>{a.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">お知らせはありません</p>
      )}
    </div>
  );
}
