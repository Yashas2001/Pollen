"use client";

import { useEffect, useState } from "react";
import type { LinkStats } from "@/lib/links";
import type { Mark } from "@/lib/marks";

// Clicks per bio link and per channel, live: polls the stats route every 10 s.
// It counts clicks. Not signups, not views. Outreach and replies have no links, so
// they count by what the founder marked on each card: sent, then got a reply.

const CHANNEL_NAME: Record<string, string> = {
  tiktok: "TikTok",
  reels: "Reels",
  shorts: "Shorts",
  x: "X",
  reddit: "Reddit",
  hn: "Hacker News",
  linkedin: "LinkedIn",
  creator: "Creators",
  partner: "Businesses",
  other: "Other",
};

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function Scoreboard({ jobId }: { jobId: string }) {
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      setRefreshing(true);
      try {
        const [res, m] = await Promise.all([
          fetch(`/api/jobs/${jobId}/stats`, { cache: "no-store" }),
          fetch(`/api/jobs/${jobId}/marks`, { cache: "no-store" }),
        ]);
        if (res.ok && alive) setStats((await res.json()) as LinkStats);
        if (m.ok && alive) setMarks((await m.json()) as Mark[]);
      } catch {
        // Keep the last numbers; try again on the next tick.
      } finally {
        if (alive) {
          setRefreshing(false);
          setNow(Date.now());
        }
      }
    }
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [jobId]);

  const links = stats?.links ?? [];
  const channels = Object.entries(stats?.byChannel ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const empty = !stats || stats.totalClicks === 0;
  const sent = marks.filter((m) => m.sent);
  const replied = marks.filter((m) => m.replied).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Scoreboard</h2>
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/40">
          <span className="relative flex h-2.5 w-2.5">
            {refreshing ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" /> : null}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <p className="text-6xl font-black tabular-nums">{stats?.totalClicks ?? 0}</p>
          <p className="text-sm text-black/50">{stats?.totalClicks === 1 ? "click" : "clicks"} from your bio links</p>
        </div>
        <div>
          <p className="text-6xl font-black tabular-nums">{replied.length}</p>
          <p className="text-sm text-black/50">
            {replied.length === 1 ? "reply" : "replies"} from {sent.length} {sent.length === 1 ? "message" : "messages"} sent
          </p>
        </div>
      </div>

      {empty && !sent.length ? (
        <p className="mt-6 rounded-2xl bg-black/5 p-4 text-sm text-black/60">
          Put your bio link up and post a video: every click shows here live. Mark replies and emails as sent and replied on their cards.
        </p>
      ) : null}

      {replied.length ? (
        <ul className="mt-6 divide-y divide-black/5">
          {replied.map((m) => (
            <li key={m.key} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.label}</p>
                <p className="text-xs text-black/50">
                  <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 font-semibold text-black/70">
                    {CHANNEL_NAME[m.channel] ?? m.channel}
                  </span>
                  replied {ago(m.at, now)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">Got a reply</span>
            </li>
          ))}
        </ul>
      ) : null}

      {links.length ? (
        <ul className="mt-6 divide-y divide-black/5">
          {links.map((l) => (
            <li key={l.code} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.label}</p>
                <p className="text-xs text-black/50">
                  <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 font-semibold text-black/70">
                    {CHANNEL_NAME[l.channel] ?? l.channel}
                  </span>
                  {l.lastClickAt ? `last click ${ago(l.lastClickAt, now)}` : "no clicks yet"}
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="text-2xl font-black tabular-nums">{l.clicks}</span>
                <span className="block text-xs text-black/40">{l.clicks === 1 ? "click" : "clicks"}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {channels.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {channels.map(([c, n]) => (
            <span key={c} className="rounded-full bg-black/5 px-3 py-1 text-sm">
              {CHANNEL_NAME[c] ?? c} <span className="font-bold tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
