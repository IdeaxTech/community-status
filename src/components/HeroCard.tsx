"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckinStatus } from "@/lib/db";

interface Attendee {
  name: string;
  status: CheckinStatus;
}

interface StatusData {
  count: number;
  attendees: Attendee[];
}

type SessionState =
  | { kind: "active" }
  | { kind: "upcoming"; startsInMin: number }
  | { kind: "ended" }
  | { kind: "next"; daysUntil: number; dateLabel: string };

const VENUE = "タワー五階 M-Studio";
const DISCORD_CHANNEL = "#もくもく会";
const SESSION_START_H = 13;
const SESSION_END_H = 20;
const THURSDAY = 4;

function getSessionState(): SessionState {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const day = now.getDay();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;
  const startMin = SESSION_START_H * 60;
  const endMin = SESSION_END_H * 60;

  if (day === THURSDAY) {
    if (totalMin >= startMin && totalMin < endMin) return { kind: "active" };
    if (totalMin < startMin) return { kind: "upcoming", startsInMin: startMin - totalMin };
    return { kind: "ended" };
  }

  const daysUntil = (THURSDAY - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(next.getDate() + daysUntil);
  const dateLabel = `${next.getMonth() + 1}/${next.getDate()}`;
  return { kind: "next", daysUntil, dateLabel };
}

function SessionBadge({ state }: { state: SessionState }) {
  if (state.kind === "active")
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
        style={{
          background: "linear-gradient(270deg,#6366f1,#8b5cf6,#ec4899,#6366f1)",
          backgroundSize: "300% 300%",
          animation: "iridescent 4s linear infinite, glowPulse 2s ease-in-out infinite",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" />
        開催中
      </span>
    );
  if (state.kind === "upcoming") {
    const h = Math.floor(state.startsInMin / 60);
    const m = state.startsInMin % 60;
    const label = h > 0 ? `${h}時間${m}分後に開始` : `${m}分後に開始`;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
        text-sky-300 border border-sky-400/30"
        style={{ background: "rgba(14,165,233,0.12)", backdropFilter: "blur(8px)" }}
      >
        <span className="w-2 h-2 rounded-full bg-sky-400" />
        本日開催 — {label}
      </span>
    );
  }
  if (state.kind === "ended")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
        text-slate-400 border border-slate-500/20"
        style={{ background: "var(--glass)" }}
      >
        本日終了
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
      text-slate-400 border border-slate-500/20"
      style={{ background: "var(--glass)" }}
    >
      次回: {state.dateLabel}（{state.daysUntil}日後）
    </span>
  );
}

function AttendeeBadge({ status }: { status: CheckinStatus }) {
  if (status === "at_venue")
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
        在席中
      </span>
    );
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
      向かっています
    </span>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-slate-700/50 dark:bg-slate-700/50 bg-slate-200 rounded w-24" />
      <div className="h-12 bg-slate-700/50 dark:bg-slate-700/50 bg-slate-200 rounded w-20" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-slate-700/50 dark:bg-slate-700/50 bg-slate-200 rounded" />
        ))}
      </div>
    </div>
  );
}

const LS_KEY = "mokumoku_discord_name";

export function HeroCard({
  onReloadRef,
  showToast,
}: {
  onReloadRef?: React.MutableRefObject<(() => void) | null>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [data, setData] = useState<StatusData | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>(getSessionState());
  const [savedName, setSavedName] = useState("");
  const [inputName, setInputName] = useState("");
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus>("at_venue");
  const [loading, setLoading] = useState(false);
  const [myName, setMyName] = useState<string | null>(null);
  const loadFnRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) ?? "";
    setSavedName(stored);
    setInputName(stored);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/status");
    const json = (await res.json()) as StatusData;
    setData(json);
  }, []);

  useEffect(() => {
    loadFnRef.current = () => void load();
    if (onReloadRef) onReloadRef.current = loadFnRef.current;
    void load();
    const dataTimer = setInterval(() => void load(), 30000);
    const stateTimer = setInterval(() => setSessionState(getSessionState()), 60000);
    return () => { clearInterval(dataTimer); clearInterval(stateTimer); };
  }, [load, onReloadRef]);

  const effectiveName = inputName.trim() || savedName;

  async function handleCheckin() {
    if (!effectiveName) return;
    setLoading(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_name: effectiveName, status: checkinStatus }),
    });
    setLoading(false);
    if (res.ok) {
      localStorage.setItem(LS_KEY, effectiveName);
      setSavedName(effectiveName);
      setMyName(effectiveName);
      showToast(checkinStatus === "at_venue" ? "チェックインしました" : "「向かっています」で登録しました");
      void load();
    } else {
      showToast("チェックインに失敗しました", "error");
    }
  }

  async function handleCheckout() {
    const name = myName ?? savedName;
    if (!name) return;
    setLoading(true);
    const res = await fetch("/api/checkin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_name: name }),
    });
    setLoading(false);
    if (res.ok) {
      setMyName(null);
      showToast("チェックアウトしました");
      void load();
    } else {
      showToast("チェックアウトに失敗しました", "error");
    }
  }

  const isCheckedIn = myName
    ? data?.attendees.some((a) => a.name === myName)
    : savedName
    ? data?.attendees.some((a) => a.name === savedName)
    : false;

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted mb-1">毎週木曜日 13:00〜20:00</p>
          <h2 className="font-semibold text-base" style={{ color: "var(--text)" }}>
            {VENUE}
          </h2>
          <p className="text-xs text-muted">{DISCORD_CHANNEL}</p>
        </div>
        <SessionBadge state={sessionState} />
      </div>

      {/* Attendees */}
      {data === null ? (
        <Skeleton />
      ) : (
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
              {data.count}
            </span>
            <span className="text-muted text-sm">人参加中</span>
          </div>

          {data.attendees.length > 0 ? (
            <ul className="space-y-2">
              {data.attendees.map((a) => (
                <li key={a.name} className="flex items-center justify-between py-1.5 px-3 rounded-xl border"
                  style={{ background: "var(--glass)", borderColor: "var(--glass-border)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {a.name}
                  </span>
                  <AttendeeBadge status={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">まだ誰もいません — 最初の一人になりませんか？</p>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t" style={{ borderColor: "var(--border)" }} />

      {/* Check-in form */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">チェックイン</p>

        {isCheckedIn ? (
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text)" }}>
              <span className="font-medium">{myName ?? savedName}</span> で参加中
            </span>
            <button
              onClick={() => void handleCheckout()}
              disabled={loading}
              className="text-sm px-4 py-1.5 rounded-full border transition-all duration-150 cursor-pointer
                hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40
                active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500
                disabled:opacity-40"
              style={{
                borderColor: "var(--glass-border)",
                color: "var(--muted)",
                boxShadow: "inset 0 1px 0 var(--glass-highlight)",
              }}
            >
              チェックアウト
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder={savedName ? savedName : "Discord 名を入力"}
              className="w-full px-4 py-2.5 rounded-2xl text-sm border outline-none transition-all duration-150
                focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
              style={{
                background: "var(--glass)",
                borderColor: "var(--glass-border)",
                color: "var(--text)",
                backdropFilter: "blur(16px)",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06), inset 0 1px 0 var(--glass-highlight)",
              }}
            />

            {/* Status toggle */}
            <div className="flex gap-2">
              {(["at_venue", "on_the_way"] as CheckinStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setCheckinStatus(s)}
                  className={`flex-1 py-2 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer
                    active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500
                    ${checkinStatus === s
                      ? s === "at_venue"
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : "bg-amber-500/20 border-amber-500/50 text-amber-400"
                      : "text-muted hover:border-slate-400/40"}`}
                  style={{
                    borderColor: checkinStatus === s ? undefined : "var(--glass-border)",
                    boxShadow: "inset 0 1px 0 var(--glass-highlight)",
                  }}
                >
                  {s === "at_venue" ? "在席中" : "向かっています"}
                </button>
              ))}
            </div>

            <button
              onClick={() => void handleCheckin()}
              disabled={loading || !effectiveName}
              className="w-full py-2.5 rounded-full text-sm font-semibold text-white
                transition-all duration-150 cursor-pointer
                active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300
                disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                boxShadow: "0 4px 16px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.10)",
              }}
            >
              {loading ? "登録中…" : savedName && !inputName.trim() ? `${savedName} でチェックイン` : "チェックイン"}
            </button>

            {savedName && (
              <button
                onClick={() => { localStorage.removeItem(LS_KEY); setSavedName(""); setInputName(""); }}
                className="w-full text-xs text-muted hover:text-red-400 transition-colors duration-150 cursor-pointer"
              >
                保存済みの名前を削除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
