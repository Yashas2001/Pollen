"use client";

import { useState } from "react";
import type { Job } from "@/lib/jobs";
import type { Person, Platform } from "@/lib/people/types";

const PLATFORM: Record<Platform, { name: string; badge: string }> = {
  reddit: { name: "Reddit", badge: "bg-orange-100 text-orange-800" },
  hn: { name: "Hacker News", badge: "bg-amber-100 text-amber-800" },
  linkedin: { name: "LinkedIn", badge: "bg-sky-100 text-sky-800" },
  x: { name: "X", badge: "bg-black/10 text-black" },
};

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 60 / 24)} d ago`;
}

// People asking for this product right now, with a reply ready for each. Nothing is posted for them.
export function People({ job }: { job: Job }) {
  const people = job.people ?? [];
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">People asking for this right now</h2>
      <p className="text-sm text-black/50">Real posts from the last 7 days. Nothing is posted for you.</p>
      {job.peopleStatus === "finding" || !job.peopleStatus ? (
        <p className="mt-6 text-black/60">Looking for people asking...</p>
      ) : job.peopleStatus === "failed" ? (
        <p className="mt-6 text-black/60">Couldn&apos;t search right now. Try again with a new link later.</p>
      ) : people.length === 0 ? (
        <p className="mt-6 text-black/60">No one asking for this in the last week.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {people.map((p) => (
            <PersonCard key={p.url} person={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PersonCard({ person }: { person: Person }) {
  const [reply, setReply] = useState(person.reply);
  const [copied, setCopied] = useState(false);
  const platform = PLATFORM[person.platform];
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl border border-black/10 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${platform.badge}`}>{platform.name}</span>
        <span className="min-w-0 truncate font-semibold">{person.author}</span>
        <span className="text-black/50">{ago(person.postedAt)}</span>
      </div>
      <p className="line-clamp-4 whitespace-pre-line break-words text-black/80">{person.text}</p>
      <p className="text-sm">
        <span className="font-semibold">Why: </span>
        {person.why}
      </p>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your reply
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={7}
          className="rounded-2xl border border-black/15 p-3 text-base font-normal"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <a
          href={person.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-black px-5 py-3 text-center font-semibold text-white"
        >
          Open post
        </a>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(reply);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-2xl border border-black/15 px-5 py-3 font-semibold"
        >
          {copied ? "Copied" : "Copy reply"}
        </button>
        {person.replyUrl ? (
          <a
            href={person.replyUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-black/15 px-5 py-3 text-center font-semibold"
          >
            Reply on X
          </a>
        ) : null}
      </div>
    </article>
  );
}
