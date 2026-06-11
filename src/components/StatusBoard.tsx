"use client";

import { useEffect, useRef, useState } from "react";

interface StatusData {
  count: number;
  names: string[];
}

export function StatusBoard({
  onReloadRef,
}: {
  onReloadRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [data, setData] = useState<StatusData>({ count: 0, names: [] });
  const loadRef = useRef<() => void>(() => undefined);

  async function load() {
    const res = await fetch("/api/status");
    const json = (await res.json()) as StatusData;
    setData(json);
  }

  useEffect(() => {
    loadRef.current = () => void load();
    if (onReloadRef) onReloadRef.current = loadRef.current;

    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-2">現在の参加者</h2>
      <p className="text-3xl font-bold mb-2">{data.count}人</p>
      {data.names.length > 0 ? (
        <ul className="space-y-1">
          {data.names.map((name) => (
            <li key={name} className="text-sm text-gray-700">
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">まだ誰もいません</p>
      )}
    </section>
  );
}
