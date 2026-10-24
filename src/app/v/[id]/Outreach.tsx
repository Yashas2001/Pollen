"use client";

import { useState } from "react";
import type { Creator, Outreach as OutreachData, Partner } from "@/lib/outreach/types";
import { MarkButtons, useMarks, type Marks } from "./Marks";

// Real creators and businesses to reach out to, each with why and a message written
// for them. Contacts are only what they publish. Nothing is sent for them.

const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// The page fetches the list once (for the tab count) and hands it here.
export function Outreach({ jobId, data, failed }: { jobId: string; data: OutreachData | null; failed: boolean }) {
  const marks = useMarks(jobId);
  if (!data) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Who to reach out to</h2>
        <p className="mt-6 text-black/60">
          {failed ? "Couldn't search right now. Open this tab again in a minute." : "Finding creators and businesses that reach your buyers. About a minute..."}
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Creators</h2>
        <p className="text-sm text-black/50">YouTube creators whose viewers are your buyers. No links in the messages: they ask for a reply. Mark each one when you send it and when they answer.</p>
        {data.creators.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {data.creators.map((c) => (
              <CreatorCard key={c.url} creator={c} marks={marks} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-black/60">No good creator fits found this time.</p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Businesses</h2>
        <p className="text-sm text-black/50">Agencies, studios, newsletters and tools that already serve your buyers. Emails are only ones they list on their own site.</p>
        {data.partners.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {data.partners.map((p) => (
              <PartnerCard key={p.website} partner={p} marks={marks} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-black/60">No good business fits found this time.</p>
        )}
      </section>
    </div>
  );
}

function CreatorCard({ creator: c, marks }: { creator: Creator; marks: Marks }) {
  const [dm, setDm] = useState(c.dm);
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl border border-black/10 p-5">
      <div className="flex items-center gap-3">
        {c.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="text-sm text-black/50">{c.subscribers === null ? "YouTube" : `${fmt(c.subscribers)} subscribers on YouTube`}</p>
        </div>
      </div>
      <a href={c.video.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-black/5 px-4 py-3 text-sm hover:bg-black/10">
        <span className="font-semibold">{fmt(c.video.views)} views: </span>
        {c.video.title}
      </a>
      <p className="text-sm">
        <span className="font-semibold">Why: </span>
        {c.why}
      </p>
      {c.email ? <p className="break-all text-sm"><span className="font-semibold">Email: </span>{c.email}</p> : null}
      {c.subject ? (
        <p className="text-sm">
          <span className="font-semibold">Subject: </span>
          {c.subject}
        </p>
      ) : null}
      <Message label="Your message" value={dm} onChange={setDm} />
      <div className="flex flex-wrap gap-2">
        {c.email ? (
          <a href={mailto(c.email, c.subject, dm)} className="rounded-2xl bg-black px-5 py-3 text-center font-semibold text-white">
            Email them
          </a>
        ) : null}
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className={`rounded-2xl px-5 py-3 text-center font-semibold ${c.email ? "border border-black/15" : "bg-black text-white"}`}
        >
          Open channel
        </a>
        <CopyButton text={dm} label="Copy message" />
      </div>
      <MarkButtons marks={marks} k={c.url} label={`Creator: ${c.name}`} channel="creator" />
    </article>
  );
}

function PartnerCard({ partner: p, marks }: { partner: Partner; marks: Marks }) {
  const [body, setBody] = useState(p.body);
  const domain = p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl border border-black/10 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-black/5 px-3 py-1 font-semibold">{p.kind}</span>
        <span className="min-w-0 truncate font-semibold">{p.name}</span>
        <a href={p.website} target="_blank" rel="noreferrer" className="text-black/50 underline">
          {domain}
        </a>
      </div>
      <p className="text-sm">
        <span className="font-semibold">Why: </span>
        {p.why}
      </p>
      <p className="break-all text-sm">
        <span className="font-semibold">Ask for: </span>
        {p.contactRole}
        {p.email ? ` at ${p.email}` : ""}
      </p>
      <p className="text-sm">
        <span className="font-semibold">Subject: </span>
        {p.subject}
      </p>
      <Message label="Your email" value={body} onChange={setBody} />
      <div className="flex flex-wrap gap-2">
        {p.email ? (
          <a href={mailto(p.email, p.subject, body)} className="rounded-2xl bg-black px-5 py-3 text-center font-semibold text-white">
            Email them
          </a>
        ) : null}
        {p.contactPage ? (
          <a
            href={p.contactPage}
            target="_blank"
            rel="noreferrer"
            className={`rounded-2xl px-5 py-3 text-center font-semibold ${p.email ? "border border-black/15" : "bg-black text-white"}`}
          >
            Contact page
          </a>
        ) : null}
        {p.linkedin ? (
          <a href={p.linkedin} target="_blank" rel="noreferrer" className="rounded-2xl border border-black/15 px-5 py-3 text-center font-semibold">
            LinkedIn
          </a>
        ) : null}
        <CopyButton text={`${p.subject}\n\n${body}`} label="Copy email" />
      </div>
      <MarkButtons marks={marks} k={p.website} label={`Business: ${p.name}`} channel="partner" />
    </article>
  );
}

const mailto = (to: string, subject: string, body: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

function Message({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={7} className="rounded-2xl border border-black/15 p-3 text-base font-normal" />
    </label>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-2xl border border-black/15 px-5 py-3 font-semibold"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
