"use client";

import { useEffect, useState } from "react";
import type { Mark, MarkChannel } from "@/lib/marks";

// "Sent" and "Got a reply" on every message card. Messages carry no link, so these
// marks are how the scoreboard knows what worked.

export type Marks = {
  get: (key: string) => Mark | undefined;
  set: (m: { key: string; label: string; channel: MarkChannel; sent: boolean; replied: boolean }) => void;
};

export function useMarks(jobId: string): Marks {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${jobId}/marks`, { cache: "no-store" })
      .then(async (r) => r.ok && alive && setMarks(Object.fromEntries(((await r.json()) as Mark[]).map((m) => [m.key, m]))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [jobId]);
  return {
    get: (key) => marks[key],
    set: (m) => {
      // Show it at once; the save happens behind.
      setMarks((all) => ({ ...all, [m.key]: { ...m, at: new Date().toISOString() } }));
      void fetch(`/api/jobs/${jobId}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      }).catch(() => {});
    },
  };
}

export function MarkButtons({ marks, k, label, channel }: { marks: Marks; k: string; label: string; channel: MarkChannel }) {
  const m = marks.get(k);
  const sent = !!m?.sent;
  const replied = !!m?.replied;
  const on = "border-emerald-600 bg-emerald-50 text-emerald-900";
  const off = "border-black/15 text-black/70";
  return (
    <div className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
      <button
        onClick={() => marks.set({ key: k, label, channel, sent: !sent, replied: sent ? false : replied })}
        className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${sent ? on : off}`}
      >
        {sent ? "✓ Sent" : "Mark as sent"}
      </button>
      <button
        onClick={() => marks.set({ key: k, label, channel, sent: true, replied: !replied })}
        className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${replied ? on : off}`}
      >
        {replied ? "✓ Got a reply" : "Got a reply"}
      </button>
    </div>
  );
}
