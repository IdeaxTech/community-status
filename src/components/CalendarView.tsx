"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  id: number;
  date: string;
  title: string;
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

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

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

  async function handleAddEvent(date: string) {
    if (!inputValue.trim()) return;
    setSubmitting(true);
    setAddError("");
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title: inputValue.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setAddError(err.error ?? "追加に失敗しました");
        return;
      }
      setAdding(null);
      setInputValue("");
      await loadEvents(year, month);
    } finally {
      setSubmitting(false);
    }
  }

  const thursdayDays = getThursdaysOfMonth(year, month);
  const grid = buildCalendarGrid(year, month);
  const eventsByDate = events.reduce<Record<string, string[]>>((acc, e) => {
    acc[e.date] = [...(acc[e.date] ?? []), e.title];
    return acc;
  }, {});

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
          if (!day)
            return (
              <div key={i} className="min-h-14" style={{ background: "var(--bg)" }} />
            );

          const dateStr = toDateStr(year, month, day);
          const isThu = thursdayDays.includes(day);
          const dayEvents = eventsByDate[dateStr] ?? [];
          const isAdding = adding === dateStr;
          const col = i % 7;
          const dayColor =
            col === 0 ? "text-red-400" : col === 6 ? "text-blue-400" : "";

          return (
            <div
              key={i}
              className={`min-h-14 p-1 cursor-pointer transition-colors duration-150
                ${isThu ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-slate-500/10"}`}
              style={isThu ? undefined : { background: "var(--card)" }}
              onClick={() => {
                setAdding(isAdding ? null : dateStr);
                setInputValue("");
                setAddError("");
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
              {dayEvents.map((title, j) => (
                <p key={j} className="text-xs text-blue-400 leading-tight mt-0.5 break-words">
                  {title}
                </p>
              ))}
              {isAdding && (
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddEvent(dateStr);
                      if (e.key === "Escape") setAdding(null);
                    }}
                    placeholder="イベント名"
                    className="w-full text-xs rounded px-1 py-0.5 border outline-none
                      focus:border-blue-500"
                    style={{
                      background: "var(--bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <button
                    onClick={() => void handleAddEvent(dateStr)}
                    disabled={submitting || !inputValue.trim()}
                    className="mt-0.5 w-full text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-0.5
                      disabled:opacity-40 transition-colors duration-150 cursor-pointer"
                  >
                    追加
                  </button>
                  {addError && (
                    <p className="text-xs text-red-400 mt-0.5">{addError}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">日付をクリックしてイベントを追加</p>
    </div>
  );
}
