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
          className="flex-1 px-4 py-2 rounded-full text-sm border outline-none transition-all duration-150
            focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          style={{
            background: "var(--glass)",
            borderColor: "var(--glass-border)",
            color: "var(--text)",
            backdropFilter: "blur(16px)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06), inset 0 1px 0 var(--glass-highlight)",
          }}
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || !content.trim()}
          className="px-5 py-2 rounded-full text-sm font-semibold text-white
            transition-all duration-150 cursor-pointer active:scale-95
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300
            disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            boxShadow: "0 4px 14px rgba(234,88,12,0.35), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.10)",
          }}
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
              style={{ background: "var(--glass)" }}
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
