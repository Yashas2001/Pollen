"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/lib/jobs";
import type { Outlier, Research } from "@/lib/research/types";

// While a job runs: the steps, a line about what it's doing right now, and what
// research has found so far. The lines describe real work in each step, never filler.

const STEPS: { step: Job["step"]; label: string }[] = [
  { step: "reading_site", label: "Read your site" },
  { step: "researching", label: "Find what's working" },
  { step: "writing", label: "Write your videos" },
  { step: "voicing", label: "Record the voices" },
];

const LINES: Partial<Record<Job["step"], string[]>> = {
  queued: ["Getting started"],
  reading_site: [
    "Opening your site like a customer would",
    "Taking screenshots on a phone",
    "Reading what you sell and who it's for",
    "Picking up your brand colours and logo",
  ],
  researching: [
    "Working out who you compete with",
    "Pulling their latest Shorts",
    "Comparing every Short to its channel's usual views",
    "Throwing out paid reach and lucky flukes",
    "Watching the winners frame by frame",
    "Writing down why each one worked",
  ],
  writing: [
    "Borrowing the hit's structure, not its words",
    "Writing hooks for the first two seconds",
    "Cutting your product into each shot",
    "Keeping every claim to what your site says",
  ],
  voicing: ["Recording the voiceovers", "Timing captions to every word", "Snapping cuts to the beat"],
};

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const times = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}x`;

export function Waiting({ job }: { job: Job }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lines = LINES[job.step] ?? ["Working"];
  // Changes every 3 s; keyed so each new line fades in.
  const line = lines[Math.floor(now / 3000) % lines.length];
  const current = STEPS.findIndex((s) => s.step === job.step);
  const elapsed = Math.max(0, Math.round((now - new Date(job.createdAt).getTime()) / 1000));
  const domain = job.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  return (
    <div className="flex w-full max-w-3xl flex-1 flex-col items-center pt-10 text-center sm:pt-16">
      <p className="max-w-full truncate rounded-full bg-white px-4 py-1.5 text-sm text-black/60 shadow-sm">{domain}</p>

      <div className="relative mt-8 h-14 w-14">
        <span className="absolute inset-0 animate-ping rounded-full bg-black/5" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-black/10 border-t-black" />
      </div>

      <p key={line} className="pollen-fade-up mt-6 min-h-[2.5em] text-xl font-semibold sm:text-2xl">
        <span className="pollen-shimmer">{line}</span>
      </p>
      <p className="text-sm tabular-nums text-black/40">{clock(elapsed)} · usually a couple of minutes</p>

      <ol className="mt-8 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const state = current === -1 ? "todo" : i < current ? "done" : i === current ? "now" : "todo";
          return (
            <li
              key={s.step}
              className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                state === "now" ? "bg-black text-white" : state === "done" ? "bg-white text-black" : "bg-black/[0.03] text-black/35"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  state === "now" ? "bg-white/20" : state === "done" ? "bg-emerald-500 text-white" : "bg-black/5"
                }`}
              >
                {state === "done" ? "✓" : state === "now" ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>

      {job.research?.niche ? <ResearchLive research={job.research} searching={job.step === "researching"} /> : null}
    </div>
  );
}

// What research has found so far: the niche, who we're checking, what beat its channel.
function ResearchLive({ research, searching }: { research: Research; searching: boolean }) {
  const { niche, outliers } = research;
  if (!niche) return null;
  return (
    <div className="pollen-fade-up mt-8 w-full rounded-3xl bg-white p-6 text-left shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Your market</p>
      <p className="mt-1 text-xl font-bold">{niche.niche}</p>
      {niche.audience ? <p className="text-sm text-black/50">Bought by {niche.audience.charAt(0).toLowerCase() + niche.audience.slice(1)}</p> : null}

      {niche.competitors.length ? (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-black/40">
            {outliers.length || !searching ? "Checked their Shorts" : "Checking their Shorts"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {niche.competitors.map((c, i) => (
              <span
                key={c.name}
                style={{ animationDelay: `${i * 80}ms` }}
                className="pollen-fade-up flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-sm"
              >
                {outliers.length || !searching ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/50" />
                )}
                {c.name}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-black/40">
        {outliers.length ? `${outliers.length} beat their channel's usual views` : "Looking for videos that beat their channel's usual views"}
      </p>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {outliers.slice(0, 6).map((o, i) => (
          <Thumb key={o.videoId} o={o} delay={i * 120} />
        ))}
        {/* Placeholders while it's still looking. */}
        {searching && !outliers.length
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={`p${i}`} className="w-24 shrink-0 sm:w-28">
                <div className="pollen-skeleton aspect-[9/16] w-full rounded-xl" />
                <div className="pollen-skeleton mt-2 h-3 w-12 rounded" />
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function Thumb({ o, delay }: { o: Outlier; delay: number }) {
  return (
    <a href={o.url} target="_blank" rel="noreferrer" style={{ animationDelay: `${delay}ms` }} className="pollen-pop w-24 shrink-0 sm:w-28">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.thumbnail} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-0.5 text-xs font-bold text-white">{times(o.multiple)}</span>
        {o.recipe ? <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold">Watched</span> : null}
      </div>
      <p className="mt-1 truncate text-xs text-black/60">{o.channel}</p>
    </a>
  );
}
