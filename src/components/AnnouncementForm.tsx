"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: number;
  content: string;
  created_at: string;
}

export function AnnouncementForm() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  async function loadAnnouncements() {
    const res = await fetch("/api/announcements");
    const json = await res.json() as Announcement[];
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
    await loadAnnouncements();
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-2">会場状況のお知らせ</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例: 今日は隣のイベントで少し狭いです"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || !content.trim()}
          className="bg-orange-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          投稿
        </button>
      </div>
      {announcements.length > 0 ? (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="text-sm border-l-2 border-orange-300 pl-3">
              <span className="text-gray-500 text-xs">{a.created_at}</span>
              <p>{a.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">お知らせはありません</p>
      )}
    </section>
  );
}
