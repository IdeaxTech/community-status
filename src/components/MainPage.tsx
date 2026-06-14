"use client";

import { useCallback, useRef } from "react";
import { StatusBoard } from "./StatusBoard";
import { CheckinForm } from "./CheckinForm";
import { AnnouncementForm } from "./AnnouncementForm";

export function MainPage() {
  const reloadRef = useRef<(() => void) | null>(null);

  const handleUpdate = useCallback(() => {
    reloadRef.current?.();
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">もくもく会 現地状況</h1>
        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm space-y-1">
          <p className="font-semibold">📅 定期開催</p>
          <p>毎週土曜日 13:00〜18:00</p>
          <p className="text-gray-600">会場: コミュニティスペース（詳細は Discord #general 参照）</p>
        </div>
      </header>

      <StatusBoard onReloadRef={reloadRef} />
      <CheckinForm onUpdate={handleUpdate} />
      <AnnouncementForm />
    </main>
  );
}
