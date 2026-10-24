"use client";

import Link from "next/link";
import { Player, Thumbnail } from "@remotion/player";
import { useCallback, useEffect, useState } from "react";
import { SocialVideo, totalFrames } from "@/remotion/SocialVideo";
import { FPS, HEIGHT, WIDTH } from "@/remotion/schema";
import type { Job, JobVideo } from "@/lib/jobs";
import type { Outlier } from "@/lib/research/types";
import type { LinkStats } from "@/lib/links";
import { People } from "./People";
import { Scoreboard } from "./Scoreboard";
import { EarlyAccess } from "./EarlyAccess";
import { Outreach } from "./Outreach";
import { Waiting } from "./Waiting";
import type { Outreach as OutreachData } from "@/lib/outreach/types";

const FORMAT_NAME: Record<string, string> = {
  hook_demo: "Hook + demo",
  problem_fix: "Problem to fix",
  three_reasons: "3 reasons",
};

export function JobView({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    setJob((await res.json()) as Job);
  }, [id]);

  const busy =
    !job || (job.step !== "ready" && job.step !== "failed") || job.videos.some((v) => v.render.status === "rendering") ||
    job.peopleStatus === "finding";

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = busy ? setInterval(load, 1500) : undefined;
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, busy]);

  if (missing) return <p>That link doesn&apos;t exist.</p>;
  if (!job) return <p className="text-black/50">Loading...</p>;

  if (job.step === "failed") {
    return (
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">That didn&apos;t work</h1>
        <p className="mt-2 text-black/60">{job.error}</p>
        <Link href="/app" className="mt-6 inline-block rounded-2xl bg-black px-6 py-3 font-semibold text-white">
          Try another link
        </Link>
      </div>
    );
  }

  if (job.step !== "ready") {
    return <Waiting job={job} />;
  }

  return <Results job={job} onRender={load} />;
}

type Tab = "overview" | "videos" | "people" | "outreach" | "clicks" | "more";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "videos", label: "Videos" },
  { id: "people", label: "People asking" },
  { id: "outreach", label: "Creators & businesses" },
  { id: "clicks", label: "Clicks" },
  { id: "more", label: "Ads & auto-posting" },
];

// Ready: a short overview of every part, and one tab per part, so nothing hides below the fold.
function Results({ job, onRender }: { job: Job; onRender: () => void }) {
  const [tab, setTabState] = useState<Tab>("overview");
  const [stats, setStats] = useState<LinkStats | null>(null);

  // The tab lives in the URL hash, so a refresh or a shared link opens the same part.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === fromHash)) setTimeout(() => setTabState(fromHash), 0);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", t === "overview" ? window.location.pathname : `#${t}`);
    window.scrollTo({ top: 0 });
  };

  // Start the creator and business search now (about a minute), so the tab and its count are ready.
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [outreachFailed, setOutreachFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${job.id}/outreach`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as OutreachData;
        if (alive) setOutreach(d);
      })
      .catch(() => alive && setOutreachFailed(true));
    return () => {
      alive = false;
    };
  }, [job.id]);
  const reachCount = outreach ? outreach.creators.length + outreach.partners.length : null;

  // Click totals for the overview and the tab badge (the Clicks tab polls on its own).
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/jobs/${job.id}/stats`, { cache: "no-store" })
        .then(async (r) => r.ok && alive && setStats((await r.json()) as LinkStats))
        .catch(() => {});
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [job.id]);

  const outliers = job.research?.outliers ?? [];
  const domain = job.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const people = job.people ?? [];
  const finding = job.peopleStatus === "finding" || !job.peopleStatus;
  const badge: Partial<Record<Tab, string>> = {
    videos: String(job.videos.length),
    people: finding ? "..." : String(people.filter((p) => p.kind !== "talking").length),
    outreach: reachCount === null ? (outreachFailed ? undefined : "...") : String(reachCount),
    clicks: String(stats?.totalClicks ?? 0),
  };

  return (
    <div className="w-full max-w-6xl">
      <header className="flex items-center justify-between gap-3 text-sm">
        <Link href="/app" className="flex min-w-0 items-center gap-2 font-semibold text-black/50 hover:text-black">
          <span aria-hidden>←</span>
          <span className="truncate">
            <span className="font-bold uppercase tracking-[0.2em]">Pollen</span> · {domain}
          </span>
        </Link>
        <Link href="/app" className="shrink-0 rounded-full bg-black px-4 py-2 font-semibold text-white">
          + New product
        </Link>
      </header>
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{job.goal ?? "Your first customers"}</h1>
      {job.plan?.brief.what ? <p className="mt-1 line-clamp-2 max-w-3xl text-black/60">{job.plan.brief.what}</p> : null}

      <nav className="sticky top-0 z-10 -mx-4 mt-6 flex gap-1 overflow-x-auto bg-[#F6F4EF]/95 px-4 py-3 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "bg-black text-white" : "bg-white text-black/70 hover:text-black"
            }`}
          >
            {t.label}
            {badge[t.id] ? (
              <span className={`rounded-full px-2 text-xs tabular-nums ${tab === t.id ? "bg-white/20" : "bg-black/5"}`}>{badge[t.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-4 [&>section]:mt-0">
        {tab === "overview" ? (
          <Overview job={job} outliers={outliers} people={people} finding={finding} stats={stats} outreach={outreach} open={setTab} />
        ) : null}
        {tab === "videos" ? <VideosTab job={job} outliers={outliers} onRender={onRender} /> : null}
        {tab === "people" ? <People job={job} /> : null}
        {tab === "outreach" ? <Outreach jobId={job.id} data={outreach} failed={outreachFailed} /> : null}
        {tab === "clicks" ? <Scoreboard jobId={job.id} /> : null}
        {tab === "more" ? <EarlyAccess job={job} /> : null}
      </div>
    </div>
  );
}

// "143x", "4.5x": decimals only where they matter.
const times = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}x`;

const PLATFORM_NAME: Record<string, string> = { reddit: "Reddit", hn: "Hacker News", linkedin: "LinkedIn", x: "X" };
const CHANNEL_NAME: Record<string, string> = { tiktok: "TikTok", reels: "Instagram", shorts: "YouTube", creator: "Creators", partner: "Businesses", ...PLATFORM_NAME };

function Overview({
  job,
  outliers,
  people,
  finding,
  stats,
  outreach,
  open,
}: {
  job: Job;
  outliers: Outlier[];
  people: NonNullable<Job["people"]>;
  finding: boolean;
  stats: LinkStats | null;
  outreach: OutreachData | null;
  open: (t: Tab) => void;
}) {
  const top = outliers[0];
  // "talking" = threads where buyers talk (shown only when few ask); never counted as asking.
  const asking = people.filter((p) => p.kind !== "talking");
  const talking = people.length - asking.length;
  const platforms = [...new Set(asking.map((p) => PLATFORM_NAME[p.platform] ?? p.platform))];
  const channels = Object.entries(stats?.byChannel ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  // One clear next move, so they know where to start.
  const next = asking.length
    ? { text: `Reply to ${asking.length} ${asking.length === 1 ? "person" : "people"} asking for this right now`, tab: "people" as Tab, cta: "Start replying" }
    : talking
    ? { text: `Join ${talking} ${talking === 1 ? "thread" : "threads"} where your buyers are talking`, tab: "people" as Tab, cta: "Open threads" }
    : { text: "Download your first video and post it, with your link in bio", tab: "videos" as Tab, cta: "Open videos" };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card label="What's working" onOpen={() => open("videos")}>
          {top ? (
            <>
              <p className="text-4xl font-black tabular-nums sm:text-5xl">{times(top.multiple)}</p>
              <p className="text-sm text-black/60">their usual views, top hit by {top.channel}</p>
              <div className="mt-3 hidden gap-2 sm:flex">
                {outliers.slice(0, 4).map((o) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={o.videoId} src={o.thumbnail} alt="" className="aspect-[9/16] w-10 rounded-md object-cover" />
                ))}
              </div>
            </>
          ) : (
            <p className="text-black/60">We used the formats that work best for products like yours.</p>
          )}
        </Card>
        <Card label="Your videos" onOpen={() => open("videos")}>
          <p className="text-4xl font-black tabular-nums sm:text-5xl">{job.videos.length}</p>
          <p className="text-sm text-black/60">ready to post</p>
          <div className="mt-3 hidden gap-2 sm:flex">
            {job.videos.map((v, i) => (
              <div key={i} className="w-10 overflow-hidden rounded-md bg-black">
                <Thumbnail
                  component={SocialVideo}
                  inputProps={v.props}
                  durationInFrames={totalFrames(v.props)}
                  fps={FPS}
                  compositionWidth={WIDTH}
                  compositionHeight={HEIGHT}
                  frameToDisplay={Math.min(24, totalFrames(v.props) - 1)}
                  style={{ width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
                />
              </div>
            ))}
          </div>
        </Card>
        <Card label="People asking now" onOpen={() => open("people")}>
          {finding ? (
            <>
              <p className="text-4xl font-black text-black/20 sm:text-5xl">...</p>
              <p className="text-sm text-black/60">Looking on Reddit, X, LinkedIn and Hacker News</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-black tabular-nums sm:text-5xl">{asking.length}</p>
              <p className="text-sm text-black/60">
                {asking.length ? `found on ${platforms.join(", ")}` : "no one asking directly"}
                {talking ? ` · ${talking} ${talking === 1 ? "thread" : "threads"} where buyers talk` : ""}
              </p>
            </>
          )}
        </Card>
        <Card label="Clicks" onOpen={() => open("clicks")}>
          <p className="text-4xl font-black tabular-nums sm:text-5xl">{stats?.totalClicks ?? 0}</p>
          <p className="text-sm text-black/60">
            {channels.length ? channels.map(([c, n]) => `${CHANNEL_NAME[c] ?? c} ${n}`).join(" · ") : "from your posts and replies, live"}
          </p>
        </Card>
      </div>

      {!finding ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-black p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Next step</p>
            <p className="mt-1 text-lg font-semibold">{next.text}</p>
          </div>
          <button onClick={() => open(next.tab)} className="shrink-0 rounded-2xl bg-white px-6 py-3 font-semibold text-black">
            {next.cta}
          </button>
        </div>
      ) : null}

      <button
        onClick={() => open("outreach")}
        className="flex items-center justify-between gap-3 rounded-3xl bg-white p-5 text-left shadow-sm hover:shadow-md"
      >
        <span>
          <span className="block font-semibold">
            {outreach
              ? `${outreach.creators.length} creators and ${outreach.partners.length} businesses to reach`
              : "Creators & businesses to reach"}
          </span>
          <span className="block text-sm text-black/60">Real creators, agencies and newsletters that reach your buyers, with a message for each.</span>
        </span>
        <span className="shrink-0 text-sm font-semibold">Open ›</span>
      </button>

      <button
        onClick={() => open("more")}
        className="flex items-center justify-between gap-3 rounded-3xl bg-white p-5 text-left shadow-sm hover:shadow-md"
      >
        <span>
          <span className="block font-semibold">Ads &amp; auto-posting</span>
          <span className="block text-sm text-black/60">Your Meta and Google ads and this week&apos;s posting plan, ready to launch.</span>
        </span>
        <span className="shrink-0 text-sm font-semibold">Open ›</span>
      </button>
    </div>
  );
}

function Card({ label, onOpen, children }: { label: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onOpen} className="flex min-h-44 flex-col rounded-3xl bg-white p-4 text-left shadow-sm transition hover:shadow-md sm:min-h-56 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">{label}</p>
      <div className="mt-3 flex-1">{children}</div>
      <p className="mt-4 text-sm font-semibold">Open ›</p>
    </button>
  );
}

const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// One video at a time: the hit it's based on next to our version, so the link is obvious.
function VideosTab({ job, outliers, onRender }: { job: Job; outliers: Outlier[]; onRender: () => void }) {
  const [i, setI] = useState(0);
  const video = job.videos[i];
  if (!video) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {job.videos.map((v, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-left text-sm ${
              k === i ? "bg-black text-white" : "bg-white text-black/70 hover:text-black"
            }`}
          >
            <span className="font-bold">Video {k + 1}</span>
            <span className={`max-w-48 truncate ${k === i ? "text-white/60" : "text-black/40"}`}>{v.props.script.title}</span>
          </button>
        ))}
      </div>
      <VideoPair key={i} jobId={job.id} domain={job.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")} index={i} video={video} basedOn={outliers[video.props.script.basedOn] ?? null} onRender={onRender} />
      {job.bioLinks?.length ? <BioLinks links={job.bioLinks} /> : null}
    </div>
  );
}

function VideoPair({
  jobId,
  domain,
  index,
  video,
  basedOn,
  onRender,
}: {
  jobId: string;
  domain: string;
  index: number;
  video: JobVideo;
  basedOn: Outlier | null;
  onRender: () => void;
}) {
  const { props, render } = video;
  const [copied, setCopied] = useState(false);
  const caption = `${props.script.postCaption}\n\n${props.script.hashtags.map((h) => `#${h}`).join(" ")}`;

  async function startRender() {
    await fetch(`/api/jobs/${jobId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    onRender();
  }

  const yours = props.script.shots[0]?.onScreenText;
  const rows: [string, string, string][] = basedOn
    ? [
        ["Who", basedOn.channel, `You (${domain})`],
        ["Views", fmt(basedOn.views), "Not posted yet"],
        ["Their usual views", fmt(basedOn.channelMedianViews), "–"],
        ["Beat their usual by", times(basedOn.multiple), "–"],
        ["Hook", basedOn.recipe?.hookType ?? "–", yours ? `"${yours}"` : "–"],
        ["Length", clock(basedOn.durationSeconds), clock(props.durationMs / 1000)],
        ["Why it works", basedOn.recipe?.whyItWorks ?? "–", "Same structure, made from your product"],
      ]
    : [];

  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        {basedOn ? (
          <>
            <div className="flex w-full max-w-[260px] flex-col gap-2">
              <p className="flex items-center gap-2 text-sm">
                <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold uppercase tracking-wide">Their hit</span>
                <span className="truncate text-black/60">{basedOn.channel}</span>
              </p>
              <div className="overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${basedOn.videoId}`}
                  title={basedOn.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="block w-full border-0"
                  style={{ aspectRatio: "9 / 16" }}
                />
              </div>
            </div>
            <span className="text-2xl font-bold text-black/30 sm:mt-48" aria-hidden>
              <span className="hidden sm:inline">→</span>
              <span className="sm:hidden">↓</span>
            </span>
          </>
        ) : null}
        <div className="flex w-full max-w-[260px] flex-col gap-2">
          <p className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-black px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Your version</span>
            <span className="truncate text-black/60">{basedOn ? "same format" : FORMAT_NAME[props.script.format] ?? props.script.format}</span>
          </p>
          <div className="overflow-hidden rounded-2xl bg-black">
            <Player
              component={SocialVideo}
              inputProps={props}
              durationInFrames={totalFrames(props)}
              fps={FPS}
              compositionWidth={WIDTH}
              compositionHeight={HEIGHT}
              style={{ width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
              controls
              loop
              // Open on a frame where the hook text has popped in, not the empty first frame.
              initialFrame={Math.min(24, totalFrames(props) - 1)}
            />
          </div>
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-black/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-black/40">
              <tr>
                <th className="w-40 p-3 font-semibold"></th>
                <th className="p-3 font-semibold">Their hit</th>
                <th className="p-3 font-semibold text-black">Your version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map(([label, theirs, ours]) => (
                <tr key={label}>
                  <td className="p-3 text-black/50">{label}</td>
                  <td className={`p-3 ${label === "Beat their usual by" ? "text-lg font-black" : ""}`}>{theirs}</td>
                  <td className="p-3">{ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Caption</p>
          <p className="mt-2 whitespace-pre-line rounded-2xl bg-black/5 p-4 text-sm">{caption}</p>
        </div>
        <div className="flex flex-col gap-3 md:pt-6">
          {render.status === "done" && render.file ? (
            <a href={`/api/files/${jobId}/${render.file}?download`} className="rounded-2xl bg-black px-5 py-3 text-center font-semibold text-white">
              Download video
            </a>
          ) : (
            <button
              onClick={startRender}
              disabled={render.status === "rendering"}
              className="rounded-2xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {render.status === "rendering" ? "Making your MP4..." : render.status === "failed" ? "Try download again" : "Download video"}
            </button>
          )}
          <button
            onClick={() => {
              void navigator.clipboard.writeText(caption);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-2xl border border-black/15 px-5 py-3 font-semibold"
          >
            {copied ? "Copied" : "Copy caption"}
          </button>
          <p className="text-sm text-black/50">Post it on TikTok, Reels or Shorts, and put your profile link (below) on that profile.</p>
        </div>
      </div>
    </section>
  );
}

// 0:45, 1:05
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

const BIO_NAME = { tiktok: "TikTok", reels: "Instagram", shorts: "YouTube" } as const;

// Captions on TikTok / Reels / Shorts aren't clickable, so clicks come through the bio link.
function BioLinks({ links }: { links: NonNullable<Job["bioLinks"]> }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Your profile link</h2>
      <p className="mb-4 max-w-2xl text-sm text-black/50">
        Captions on TikTok, Instagram and YouTube aren&apos;t clickable, so people tap the link on your profile. Put the
        matching one there instead of your website: it opens your site and counts every click on your Clicks tab.
      </p>
      <div className="flex flex-col gap-2">
        {links.map((l) => (
          <div key={l.channel} className="flex flex-wrap items-center gap-3 rounded-2xl bg-black/5 p-3">
            <span className="w-24 font-semibold">{BIO_NAME[l.channel]}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-black/60">{l.url}</span>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(l.url);
                setCopied(l.channel);
                setTimeout(() => setCopied(null), 1500);
              }}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              {copied === l.channel ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
