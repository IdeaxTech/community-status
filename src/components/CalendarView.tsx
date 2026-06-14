"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  id: number;
  date: string;
  title: string;
  time: string | null;
}

const MOKUMOKU_LABEL = "もくもく会 13:00〜20:00";
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function getThursdaysOfMonth(year: number, month: number): number[] {
  const days: number[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 4) days.push(date.getDate());
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatEvent(e: CalendarEvent): string {
  return e.time ? `${e.time} ${e.title}` : e.title;
}

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // 新規追加フォームの状態
  const [adding, setAdding] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addError, setAddError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 編集フォームの状態
  const [editing, setEditing] = useState<{ id: number; title: string; time: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadEvents(y: number, m: number) {
    const res = await fetch(`/api/calendar?year=${y}&month=${m}`);
    const json = (await res.json()) as CalendarEvent[];
    setEvents(json);
  }

  useEffect(() => {
    void loadEvents(year, month);
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  function openAdding(dateStr: string) {
    setEditing(null);
    setEditError("");
    setAdding(dateStr);
    setAddTitle("");
    setAddTime("");
    setAddError("");
  }

  function openEditing(e: CalendarEvent, ev: React.MouseEvent) {
    ev.stopPropagation();
    setAdding(null);
    setAddError("");
    setEditing({ id: e.id, title: e.title, time: e.time ?? "" });
    setEditError("");
  }

  async function handleAdd(date: string) {
    if (!addTitle.trim()) return;
    setSubmitting(true);
    setAddError("");
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title: addTitle.trim(), time: addTime || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setAddError(err.error ?? "追加に失敗しました");
        return;
      }
      setAdding(null);
      await loadEvents(year, month);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!editing || !editing.title.trim()) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const res = await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, title: editing.title.trim(), time: editing.time || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setEditError(err.error ?? "保存に失敗しました");
        return;
      }
      setEditing(null);
      await loadEvents(year, month);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setEditError(err.error ?? "削除に失敗しました");
        return;
      }
      setEditing(null);
      await loadEvents(year, month);
    } finally {
      setEditSubmitting(false);
    }
  }

  const thursdayDays = getThursdaysOfMonth(year, month);
  const grid = buildCalendarGrid(year, month);
  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    acc[e.date] = [...(acc[e.date] ?? []), e];
    return acc;
  }, {});

  const inputBase = [
    "w-full text-xs rounded px-1 py-0.5 border outline-none focus:border-blue-500",
  ].join(" ");
  const inputStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">イベントカレンダー</p>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors duration-150
              hover:bg-slate-500/10 cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            ‹
          </button>
          <span className="font-medium w-20 text-center text-sm" style={{ color: "var(--text)" }}>
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors duration-150
              hover:bg-slate-500/10 cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 text-center text-xs font-medium mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className={d === "日" ? "text-red-400" : d === "土" ? "text-blue-400" : "text-muted"}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-7 gap-px rounded-lg overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        {grid.map((day, i) => {
          if (!day) return <div key={i} className="min-h-14" style={{ background: "var(--bg)" }} />;

          const dateStr = toDateStr(year, month, day);
          const isThu = thursdayDays.includes(day);
          const dayEvents = eventsByDate[dateStr] ?? [];
          const isAdding = adding === dateStr;
          const col = i % 7;
          const dayColor = col === 0 ? "text-red-400" : col === 6 ? "text-blue-400" : "";

          return (
            <div
              key={i}
              className={`min-h-14 p-1 transition-colors duration-150 cursor-pointer
                ${isThu ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-slate-500/10"}`}
              style={isThu ? undefined : { background: "var(--card)" }}
              onClick={() => {
                if (editing) { setEditing(null); return; }
                openAdding(isAdding ? "" : dateStr);
                if (isAdding) setAdding(null);
              }}
            >
              <span
                className={`text-xs font-medium ${dayColor}`}
                style={dayColor ? undefined : { color: "var(--text)" }}
              >
                {day}
              </span>

              {isThu && (
                <p className="text-xs text-amber-500 leading-tight mt-0.5 break-words">
                  {MOKUMOKU_LABEL}
                </p>
              )}

              {/* 既存イベント */}
              {dayEvents.map((e) => (
                <div key={e.id} onClick={(ev) => openEditing(e, ev)}>
                  {editing?.id === e.id ? (
                    /* 編集フォーム */
                    <div className="mt-1 space-y-1" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={editing.title}
                        onChange={(ev) => setEditing({ ...editing, title: ev.target.value })}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") void handleSave();
                          if (ev.key === "Escape") setEditing(null);
                        }}
                        placeholder="イベント名"
                        className={inputBase}
                        style={inputStyle}
                      />
                      <input
                        type="time"
                        value={editing.time}
                        onChange={(ev) => setEditing({ ...editing, time: ev.target.value })}
                        className={inputBase}
                        style={inputStyle}
                      />
                      {editError && <p className="text-xs text-red-400">{editError}</p>}
                      <div className="flex gap-1">
                        <button
                          onClick={() => void handleSave()}
                          disabled={editSubmitting || !editing.title.trim()}
                          className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-0.5
                            disabled:opacity-40 transition-colors duration-150 cursor-pointer"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => void handleDelete(e.id)}
                          disabled={editSubmitting}
                          className="text-xs bg-red-600/80 hover:bg-red-600 text-white rounded px-1.5 py-0.5
                            disabled:opacity-40 transition-colors duration-150 cursor-pointer"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* イベント表示 */
                    <p className="text-xs text-blue-400 leading-tight mt-0.5 break-words hover:underline">
                      {formatEvent(e)}
                    </p>
                  )}
                </div>
              ))}

              {/* 新規追加フォーム */}
              {isAdding && !editing && (
                <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAdd(dateStr);
                      if (e.key === "Escape") setAdding(null);
                    }}
                    placeholder="イベント名"
                    className={inputBase}
                    style={inputStyle}
                  />
                  <input
                    type="time"
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className={inputBase}
                    style={inputStyle}
                  />
                  {addError && <p className="text-xs text-red-400">{addError}</p>}
                  <button
                    onClick={() => void handleAdd(dateStr)}
                    disabled={submitting || !addTitle.trim()}
                    className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-0.5
                      disabled:opacity-40 transition-colors duration-150 cursor-pointer"
                  >
                    追加
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">日付をクリックして追加 / イベントをクリックして編集・削除</p>
    </div>
  );
}
