"use client";

import { useState } from "react";

export function CheckinForm({ onUpdate }: { onUpdate: () => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCheckin() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_name: name.trim() }),
    });
    setMessage(`${name.trim()} でチェックインしました`);
    setLoading(false);
    onUpdate();
  }

  async function handleCheckout() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/checkin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_name: name.trim() }),
    });
    setMessage(`${name.trim()} をチェックアウトしました`);
    setLoading(false);
    onUpdate();
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-2">チェックイン</h2>
      <p className="text-sm text-gray-500 mb-3">Discord 名を入力してください（任意）</p>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Discord 名"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() => void handleCheckin()}
          disabled={loading || !name.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          チェックイン
        </button>
        <button
          onClick={() => void handleCheckout()}
          disabled={loading || !name.trim()}
          className="border px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          チェックアウト
        </button>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
    </section>
  );
}
