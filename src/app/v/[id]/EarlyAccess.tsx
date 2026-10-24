"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Player, Thumbnail } from "@remotion/player";
import { SocialVideo, totalFrames } from "@/remotion/SocialVideo";
import { FPS, HEIGHT, WIDTH, type VideoProps } from "@/remotion/schema";
import type { Job } from "@/lib/jobs";
import type { Channels } from "@/app/api/jobs/[id]/channels/route";

// More channels (ads, auto-post): the work is prepared and shown the way it will look
// live; launching unlocks when they connect an account. "Connect" only logs interest. Never fake live.

type ChannelId = "meta" | "google" | "autopost";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

  const domain = job.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  const brand = job.plan?.brand;
  const brandName = brand?.name || domain;
  const logo = job.videos[0]?.props.logoUrl ?? null;

  if (!work) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Ads and auto-posting</h2>
        <p className="mt-6 text-black/60">{failed ? "Couldn't prepare these right now. Open this tab again in a minute." : "Preparing your ads and posting plan..."}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Channel
        title="Meta ad"
        sub="Facebook and Instagram feeds, with your video as the ad."
        connectLabel="Connect Meta Ads"
        joined={joined.has("meta")}
        onConnect={() => connect("meta")}
        preview={<MetaPreview job={job} work={work} brandName={brandName} logo={logo} primary={brand?.primary} domain={domain} />}
      >
        <Detail label="Who sees it">
          <p className="text-sm">Age {work.meta.targeting.age}</p>
          <Chips items={work.meta.targeting.interests} />
          <Chips items={work.meta.targeting.places} muted />
        </Detail>
        <Detail label="Starting budget">
          <p className="text-3xl font-black tabular-nums">
            ${work.meta.dailyBudgetUsd}
            <span className="text-base font-semibold text-black/50"> / day</span>
          </p>
          <p className="text-sm text-black/60">{work.meta.budgetWhy}</p>
        </Detail>
        <Detail label="Ad copy" copy={`${work.meta.headline}\n\n${work.meta.primaryText}`}>
          <p className="text-sm font-semibold">{work.meta.headline}</p>
          <p className="whitespace-pre-line text-sm text-black/70">{work.meta.primaryText}</p>
        </Detail>
      </Channel>

      <Channel
        title="Google search ad"
        sub="Shows when people search for what you do."
        connectLabel="Connect Google Ads"
        joined={joined.has("google")}
        onConnect={() => connect("google")}
        preview={<GooglePreview work={work} brandName={brandName} logo={logo} primary={brand?.primary} domain={domain} />}
      >
        <Detail label="Keywords" copy={work.google.keywords.join("\n")}>
          <Chips items={work.google.keywords} />
        </Detail>
        <Detail label="Headlines" copy={work.google.headlines.join("\n")}>
          {work.google.headlines.map((h) => (
            <p key={h} className="flex justify-between gap-3 text-sm">
              <span>{h}</span>
              <span className="tabular-nums text-black/40">{h.length}/30</span>
            </p>
          ))}
        </Detail>
        <Detail label="Descriptions" copy={work.google.descriptions.join("\n")}>
          {work.google.descriptions.map((d) => (
            <p key={d} className="text-sm text-black/70">
              {d}
            </p>
          ))}
        </Detail>
      </Channel>

      <Channel
        title="Auto-posting"
        sub="Your videos go out on their own, on the best day and time for each platform."
        connectLabel="Connect TikTok, Instagram and YouTube"
        joined={joined.has("autopost")}
        onConnect={() => connect("autopost")}
        wide
        preview={<Week job={job} work={work} />}
      />
    </div>
  );
}

// One channel: the preview of how it will look, the details beside it, and the connect button.
function Channel({
  title,
  sub,
  connectLabel,
  joined,
  onConnect,
  preview,
  wide,
  children,
}: {
  title: string;
  sub: string;
  connectLabel: string;
  joined: boolean;
  onConnect: () => Promise<void>;
  preview: ReactNode;
  wide?: boolean;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{title}</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Ready</span>
          </div>
          <p className="text-sm text-black/50">{sub}</p>
        </div>
        {joined ? (
          <p className="rounded-2xl bg-black/5 px-4 py-3 text-sm font-medium sm:max-w-xs">You&apos;re on early access. We&apos;ll tell you when launching opens.</p>
        ) : (
          <button
            onClick={async () => {
              setBusy(true);
              await onConnect();
              setBusy(false);
            }}
            disabled={busy}
            className="shrink-0 rounded-2xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {connectLabel}
          </button>
        )}
      </div>
      {wide ? (
        <div className="mt-6">{preview}</div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="min-w-0 rounded-3xl bg-[#f4f2ee] p-4 sm:p-6">{preview}</div>
          <div className="flex min-w-0 flex-col gap-5">{children}</div>
        </div>
      )}
    </section>
  );
}

function Logo({ logo, name, primary, size }: { logo: string | null; name: string; primary?: string; size: number }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border border-black/10 bg-white object-contain p-0.5" />
  ) : (
    <span
      style={{ width: size, height: size, background: primary ?? "#000" }}
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// A feed post the way it will run: their logo, the copy, their video, the headline bar.
function MetaPreview({
  job,
  work,
  brandName,
  logo,
  primary,
  domain,
}: {
  job: Job;
  work: Channels;
  brandName: string;
  logo: string | null;
  primary?: string;
  domain: string;
}) {
  const [pick, setPick] = useState(0);
  const video = job.videos[pick]?.props;
  return (
    <div className="mx-auto w-full max-w-[19rem]">
      <div className="overflow-hidden rounded-2xl bg-white shadow-md">
        <div className="flex items-center gap-2 p-3">
          <Logo logo={logo} name={brandName} primary={primary} size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{brandName}</p>
            <p className="text-xs text-black/50">Sponsored</p>
          </div>
        </div>
        <p className="mx-3 mb-3 line-clamp-3 overflow-hidden text-sm">{work.meta.primaryText.replace(/\n+/g, " ")}</p>
        {video ? <Clip props={video} /> : <div className="aspect-[9/16] bg-black" />}
        <div className="flex items-center justify-between gap-3 bg-black/[0.04] p-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase text-black/50">{domain}</p>
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{work.meta.headline}</p>
          </div>
          <span className="shrink-0 rounded-md bg-black/10 px-3 py-2 text-xs font-semibold">Learn more</span>
        </div>
      </div>
      {job.videos.length > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          {job.videos.map((_, i) => (
            <button
              key={i}
              onClick={() => setPick(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pick === i ? "bg-black text-white" : "bg-white text-black/60"}`}
            >
              Video {i + 1}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Clip({ props }: { props: VideoProps }) {
  return (
    <Player
      key={props.script.title}
      component={SocialVideo}
      inputProps={props}
      durationInFrames={totalFrames(props)}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      controls
      loop
      style={{ width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
    />
  );
}

// A results page with their ad on top, laid out the way search ads show.
function GooglePreview({ work, brandName, logo, primary, domain }: { work: Channels; brandName: string; logo: string | null; primary?: string; domain: string }) {
  return (
    <div className="mx-auto w-full max-w-[19rem] overflow-hidden rounded-2xl bg-white p-4 shadow-md">
      <div className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-black/40" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <span className="truncate">{work.google.keywords[0]}</span>
      </div>
      <p className="mt-4 text-xs font-bold">Sponsored</p>
      <div className="mt-2 flex items-center gap-2">
        <Logo logo={logo} name={brandName} primary={primary} size={26} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm">{brandName}</p>
          <p className="truncate text-xs text-black/50">https://{domain}</p>
        </div>
      </div>
      <p className="mt-2 text-lg leading-snug text-[#1a0dab]">{work.google.headlines.join(" | ")}</p>
      <p className="mt-1 text-sm text-black/70">{work.google.descriptions.join(" ")}</p>
      <div className="mt-5 flex flex-col gap-2 opacity-40" aria-hidden>
        <div className="h-3 w-2/5 rounded bg-black/15" />
        <div className="h-4 w-4/5 rounded bg-[#1a0dab]/30" />
        <div className="h-3 w-full rounded bg-black/10" />
        <div className="h-3 w-3/4 rounded bg-black/10" />
      </div>
    </div>
  );
}

const PLATFORM_STYLE: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-pink-100 text-pink-800",
  youtube: "bg-red-100 text-red-800",
};
const platformStyle = (p: string) => PLATFORM_STYLE[Object.keys(PLATFORM_STYLE).find((k) => p.toLowerCase().includes(k)) ?? ""] ?? "bg-black/5";

// This week, Monday to Sunday, with each video on its day.
function Week({ job, work }: { job: Job; work: Channels }) {
  const posts = work.autopost.plan.map((p, i) => {
    const index = job.videos.findIndex((v) => v.props.script.title.toLowerCase() === p.video.toLowerCase());
    return { ...p, video: job.videos[index >= 0 ? index : i]?.props, title: p.video };
  });
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <div className="grid min-w-[46rem] grid-cols-7 gap-2">
        {DAYS.map((day) => {
          const today = posts.filter((p) => p.day.toLowerCase().startsWith(day.slice(0, 3).toLowerCase()));
          return (
            <div key={day} className={`flex min-h-56 flex-col gap-2 rounded-2xl p-2 ${today.length ? "bg-[#f4f2ee]" : "bg-black/[0.02]"}`}>
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-black/40">{day.slice(0, 3)}</p>
              {today.map((p) => (
                <div key={p.title} className="flex flex-col gap-1.5 rounded-xl bg-white p-1.5 shadow-sm">
                  {p.video ? (
                    <div className="overflow-hidden rounded-lg bg-black">
                      <Thumbnail
                        component={SocialVideo}
                        inputProps={p.video}
                        durationInFrames={totalFrames(p.video)}
                        fps={FPS}
                        compositionWidth={WIDTH}
                        compositionHeight={HEIGHT}
                        frameToDisplay={Math.min(24, totalFrames(p.video) - 1)}
                        style={{ width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
                      />
                    </div>
                  ) : null}
                  <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${platformStyle(p.platform)}`}>{p.platform}</span>
                  <p className="px-0.5 text-xs font-semibold tabular-nums">{p.time}</p>
                  <p className="line-clamp-2 px-0.5 text-[11px] leading-snug text-black/60">{p.title}</p>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chips({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`rounded-full px-3 py-1 text-sm ${muted ? "border border-black/10 text-black/60" : "bg-black/5 font-medium"}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Detail({ label, copy, children }: { label: string; copy?: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2 border-b border-black/5 pb-5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">{label}</p>
        {copy ? (
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(copy).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
