"use client";

import Link from "next/link";
import { Player } from "@remotion/player";
import { useCallback, useEffect, useState } from "react";
import { SocialVideo, totalFrames } from "@/remotion/SocialVideo";
import { FPS, HEIGHT, WIDTH } from "@/remotion/schema";
import type { Job, JobVideo } from "@/lib/jobs";
import type { Outlier, Research } from "@/lib/research/types";
import { People } from "./People";
import { Scoreboard } from "./Scoreboard";
import { EarlyAccess } from "./EarlyAccess";

const STEP_TEXT: Record<Job["step"], string> = {
  queued: "Starting...",
  reading_site: "Looking through your site...",
  researching: "Finding what's working in your niche...",
  writing: "Writing this week's posts...",
  voicing: "Recording the voiceovers...",
  ready: "",
  failed: "",
};

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
    return (
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center gap-3 pt-16 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-black" />
        <p className="text-lg font-medium">{STEP_TEXT[job.step]}</p>
        <p className="text-black/50">{job.url}</p>
        {job.research ? <ResearchLive research={job.research} /> : null}
      </div>
    );
  }

  const outliers = job.research?.outliers ?? [];
  const domain = job.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (
    <div className="w-full max-w-6xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/40">Pollen · {domain}</p>
      <h1 className="mt-1 mb-1 text-3xl font-bold">{job.goal ?? "Your first customers"}</h1>
      <p className="mb-8 text-black/60">{job.plan?.brief.what}</p>
      {outliers.length ? <WhatsWorking research={job.research!} /> : null}
      <h2 className="mb-1 text-xl font-bold">Your version</h2>
      <p className="mb-4 text-sm text-black/50">Made from your real product, in the formats that are winning right now.</p>
      <div className="flex flex-col gap-10">
        {job.videos.map((v, i) => (
          <VideoCard
            key={i}
            jobId={job.id}
            index={i}
            video={v}
            basedOn={outliers[v.props.script.basedOn] ?? null}
            onRender={load}
          />
        ))}
      </div>
      {job.bioLinks?.length ? <BioLinks links={job.bioLinks} /> : null}
      <People job={job} />
      <Scoreboard jobId={job.id} />
      <EarlyAccess job={job} />
    </div>
  );
}

const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// While research runs: who we're checking, then what beat its channel.
function ResearchLive({ research }: { research: Research }) {
  const { niche, outliers } = research;
  if (!niche) return null;
  return (
    <div className="mt-6 w-full rounded-3xl bg-white p-6 text-left shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-black/40">Your niche</p>
      <p className="mt-1 font-semibold">{niche.niche}</p>
      {niche.competitors.length ? (
        <>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-black/40">Checking their Shorts</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {niche.competitors.map((c) => (
              <span key={c.name} className="rounded-full bg-black/5 px-3 py-1 text-sm">
                {c.name}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {outliers.length ? (
        <>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-black/40">
            Found {outliers.length} that beat their channel&apos;s usual views
          </p>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {outliers.slice(0, 6).map((o) => (
              <OutlierThumb key={o.videoId} o={o} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function OutlierThumb({ o }: { o: Outlier }) {
  return (
    <a href={o.url} target="_blank" rel="noreferrer" className="w-28 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={o.thumbnail} alt="" className="aspect-[9/16] w-28 rounded-xl object-cover" />
      <p className="mt-1 text-xs font-bold">{o.multiple}x usual</p>
      <p className="truncate text-xs text-black/50">{o.channel}</p>
    </a>
  );
}

// The proof: what's winning right now, measured against each channel's own normal.
function WhatsWorking({ research }: { research: Research }) {
  const watched = research.outliers.filter((o) => o.recipe);
  return (
    <section className="mb-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">What&apos;s working in {research.niche?.niche ?? "your niche"}</h2>
      <p className="mb-4 text-sm text-black/50">
        Shorts that beat their own channel&apos;s usual views. We copied the structure of the top ones, never the content.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {(watched.length ? watched : research.outliers).map((o) => (
          <a key={o.videoId} href={o.url} target="_blank" rel="noreferrer" className="flex w-72 shrink-0 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.thumbnail} alt="" className="aspect-[9/16] w-20 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="text-2xl font-black">{o.multiple}x</p>
              <p className="text-xs text-black/50">
                {fmt(o.views)} views vs {fmt(o.channelMedianViews)} usual
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold">{o.title}</p>
              <p className="text-xs text-black/50">{o.channel}</p>
              {o.recipe ? <p className="mt-1 line-clamp-2 text-xs text-black/60">{o.recipe.whyItWorks}</p> : null}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function VideoCard({
  jobId,
  index,
  video,
  basedOn,
  onRender,
}: {
  jobId: string;
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

  return (
    <div className="grid gap-6 rounded-3xl bg-white p-4 shadow-sm sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {basedOn ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-black/40">
            Their hit · {basedOn.multiple}x usual views
          </p>
          <div className="overflow-hidden rounded-3xl bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${basedOn.videoId}`}
              title={basedOn.title}
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="block w-full border-0"
              style={{ aspectRatio: "9 / 16" }}
            />
          </div>
          <p className="text-sm text-black/60">
            {basedOn.channel} · {fmt(basedOn.views)} views vs {fmt(basedOn.channelMedianViews)} usual
          </p>
          {basedOn.recipe ? <p className="text-sm text-black/60">{basedOn.recipe.whyItWorks}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-black/40">
          {basedOn ? "Your version" : FORMAT_NAME[props.script.format] ?? props.script.format}
        </p>
      <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
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
      <div className="flex flex-col justify-end gap-3">
        <p className="text-sm text-black/50">Caption</p>
        <p className="whitespace-pre-line rounded-2xl bg-black/5 p-3 text-sm">{caption}</p>
      {render.status === "done" && render.file ? (
        <a
          href={`/api/files/${jobId}/${render.file}?download`}
          className="rounded-2xl bg-black px-5 py-3 text-center font-semibold text-white"
        >
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
      </div>
    </div>
  );
}

const BIO_NAME = { tiktok: "TikTok", reels: "Instagram", shorts: "YouTube" } as const;

// Captions on TikTok / Reels / Shorts aren't clickable, so clicks come through the bio link.
function BioLinks({ links }: { links: NonNullable<Job["bioLinks"]> }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Your link in bio</h2>
      <p className="mb-4 text-sm text-black/50">Put each one in that profile&apos;s bio. Every click shows up on your scoreboard.</p>
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
