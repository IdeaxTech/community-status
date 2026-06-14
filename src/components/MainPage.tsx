"use client";

import { HeroCard } from "./HeroCard";
import { AnnouncementForm } from "./AnnouncementForm";
import { CalendarView } from "./CalendarView";
import { Toaster } from "./Toaster";
import { useToast } from "@/hooks/useToast";

export function MainPage() {
  const { toasts, showToast } = useToast();

  return (
    <>
      <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            もくもく会 現地状況
          </h1>
          <p className="text-xs text-muted mt-0.5">リアルタイムの参加状況を確認・共有できます</p>
        </header>

        <HeroCard showToast={showToast} />
        <AnnouncementForm />
        <CalendarView />
      </main>

      <Toaster toasts={toasts} />
    </>
  );
}
