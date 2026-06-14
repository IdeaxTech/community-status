"use client";

import type { Toast } from "@/hooks/useToast";

export function Toaster({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-up px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white pointer-events-auto
            ${t.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
