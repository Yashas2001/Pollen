"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Job } from "@/lib/jobs";
import type { Channels } from "@/app/api/jobs/[id]/channels/route";

// More channels (ads, email, creators, auto-post): the work is prepared, launching
// unlocks when they connect an account. "Connect" only logs interest. Never fake live.

type ChannelId = "meta" | "google" | "email" | "creators" | "autopost";

export function EarlyAccess({ job }: { job: Job }) {
  const [work, setWork] = useState<Channels | null>(null);
  const [failed, setFailed] = useState(false);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${job.id}/channels`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Channels;
        if (alive) setWork(data);
      })
      .catch(() => alive && setFailed(true));
    fetch(`/api/early-access?jobId=${job.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ channels: string[] }>) : { channels: [] }))
      .then((d) => alive && setJoined(new Set(d.channels)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [job.id]);

  async function connect(channel: ChannelId) {
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, channel }),
      });
      if (res.ok) setJoined((s) => new Set(s).add(channel));
    } catch {
      // Leave the button so they can try again.
    }
  }

  const card = (id: ChannelId, title: string, children: ReactNode) => (
    <Card key={id} title={title} joined={joined.has(id)} onConnect={() => connect(id)}>
      {children}
    </Card>
  );

  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">More channels</h2>
      <p className="text-sm text-black/50">Ready to launch when you connect an account.</p>

      {!work ? (
        <p className="mt-6 text-sm text-black/50">
          {failed ? "Prepared work for more channels will show up here." : "Preparing your ads, emails and creator list..."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {card(
            "meta",
            "Meta ads",
            <>
              <Piece label="Headline" text={work.meta.headline} />
              <Piece label="Primary text" text={work.meta.primaryText} />
              <Piece
                label="Who to target"
                text={`Age ${work.meta.targeting.age}\nInterests: ${work.meta.targeting.interests.join(", ")}\nPlaces: ${work.meta.targeting.places.join(", ")}`}
              />
              <Piece label="Starting daily budget" text={`$${work.meta.dailyBudgetUsd}/day. ${work.meta.budgetWhy}`} />
            </>,
          )}
          {card(
            "google",
            "Google ads",
            <>
              <Piece label="Headlines" text={work.google.headlines.join("\n")} />
              <Piece label="Descriptions" text={work.google.descriptions.join("\n")} />
              <Piece label="Keywords" text={work.google.keywords.join("\n")} />
            </>,
          )}
          {card(
            "email",
            "Email",
            <>
              <Piece label="Subject" text={work.email.subject} />
              <Piece label="Email" text={work.email.body} />
            </>,
          )}
          {card(
            "creators",
            "Creator outreach",
            <>
              <Piece label="Who to reach" text={`${work.creators.niche}\nSize: ${work.creators.size}`} />
              <Piece label="DM" text={work.creators.dm} />
            </>,
          )}
          {card(
            "autopost",
            "Auto-posting",
            <Piece
              label="Suggested posting plan"
              text={work.autopost.plan.map((p) => `${p.video}: ${p.platform}, ${p.day} ${p.time}`).join("\n")}
            />,
          )}
        </div>
      )}
    </section>
  );
}

function Card({ title, joined, onConnect, children }: { title: string; joined: boolean; onConnect: () => void; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/10 p-4">
      <h3 className="font-bold">{title}</h3>
      {children}
      <div className="mt-auto pt-1">
        {joined ? (
          <p className="rounded-2xl bg-black/5 px-4 py-3 text-sm font-medium">
            You&apos;re on early access. We&apos;ll tell you when launching opens.
          </p>
        ) : (
          <button
            onClick={async () => {
              setBusy(true);
              await onConnect();
              setBusy(false);
            }}
            disabled={busy}
            className="w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Connect account
          </button>
        )}
      </div>
    </div>
  );
}

function Piece({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">{label}</p>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm">{text}</p>
    </div>
  );
}
