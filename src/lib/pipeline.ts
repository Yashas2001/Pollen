import path from "node:path";
import { readdir } from "node:fs/promises";
import type { Asset, Caption, Script, VideoProps } from "@/remotion/schema";
import { readSite } from "./site";
import { planVideos, type TalkInfo } from "./writer";
import { cutVoice, describeFootage, grabSiteVideos, prepImage, prepVideo, toPhrases, transcribe, type Footage, type Phrase } from "./footage";
import { research } from "./research";
import type { Research } from "./research/types";
import { makeVoiceover } from "./voice";
import { fileUrl, jobDir, updateJob } from "./jobs";
import { findPeople } from "./people";
import { makeLink } from "./links";
import { fetchStock } from "./stock";

// Link in -> three videos ready to preview. Rendering the MP4 is a separate step
// (only when someone hits download), so previews show up as fast as possible.
export async function runJob(id: string, url: string) {
  const dir = jobDir(id);
  try {
    await updateJob(id, (j) => void (j.step = "reading_site"));
    const site = await readSite(url, dir);

    const assets: Asset[] = [
      { url: fileUrl(id, site.fullFile), kind: "screenshot_full", width: 1080, height: site.fullHeight, label: "the website on a phone, whole page (scrolls while shown)" },
      { url: fileUrl(id, site.heroFile), kind: "screenshot_hero", width: 1080, height: site.heroHeight, label: "the website's first screen on a phone" },
      ...site.images.map((im) => ({ url: fileUrl(id, im.file), kind: "image" as const, width: im.width, height: im.height, label: im.label })),
    ];

    // Real footage (their uploads, the site's own videos) gets ready while research runs.
    const footageReady = withTimeout(prepareFootage(dir, site.videoUrls, brandTerms(site.url, site.title)), 170_000).catch((e) => {
      console.warn(`[job ${id}] footage`, (e as Error).message);
      return { videos: [], talks: [], images: [] } as Prepared;
    });

    // What's winning in this niche. Never fatal: without it the writer uses the base formats.
    await updateJob(id, (j) => void (j.step = "researching"));
    let found: Research = { niche: null, outliers: [], notes: [] };
    try {
      found = await withTimeout(
        research(site, (partial) => updateJob(id, (j) => void (j.research = partial)).then(() => {})),
        150_000,
      );
    } catch (e) {
      found.notes.push(`research: ${(e as Error).message}`);
    }
    if (found.notes.length) console.warn(`[job ${id}] research notes`, found.notes);
    await updateJob(id, (j) => void (j.research = found));

    const footage = await footageReady;
    for (const im of footage.images) assets.push({ url: fileUrl(id, im.file), kind: "image", width: im.width, height: im.height, label: im.label });
    for (const v of footage.videos)
      assets.push({ url: fileUrl(id, v.file), kind: "video", width: v.width, height: v.height, durationSec: v.durationSec, label: v.label });
    // Every phrase of every talking clip gets one number for the writer.
    const spoken: Spoken[] = [];
    footage.talks.forEach(({ clip, phrases }, c) => {
      assets.push({ url: fileUrl(id, clip.file), kind: "talk", width: clip.width, height: clip.height, durationSec: clip.durationSec, label: clip.label, captions: clip.captions });
      phrases.forEach((phrase, i) => spoken.push({ clip, assetIndex: assets.length - 1, clipNo: c, phrases, i, phrase }));
    });
    const talk: TalkInfo = spoken.length
      ? {
          clips: footage.talks.map((t, c) => ({ assetIndex: spoken.find((x) => x.clipNo === c)!.assetIndex, label: t.clip.label })),
          phrases: spoken.map((x) => ({ clip: x.clipNo, text: x.phrase.text, start: x.phrase.start, end: x.phrase.end })),
        }
      : null;

    await updateJob(id, (j) => void (j.step = "writing"));
    const plan = await planVideos(site, path.join(dir, site.heroFile), assets, site.elements, found.outliers, talk);
    // The writer sometimes points at an image or page part that doesn't exist; drop those links.
    for (const v of plan.videos)
      for (const sh of v.shots) {
        if (!assets[sh.assetIndex]) sh.assetIndex = -1;
        if (!assets[sh.secondAssetIndex]) sh.secondAssetIndex = -1;
        if (!site.elements[sh.elementIndex]) sh.elementIndex = -1;
      }
    for (const v of plan.videos) fixVoice(v, talk);
    // A dark brand never gets the light look: it reads as someone else's video.
    if (luminance(plan.brand.background) < 0.3) for (const v of plan.videos) v.theme = "dark";
    // Stock shots: fetch a clip per search (same search = same clip), in parallel.
    const stockShots = plan.videos.flatMap((v) => v.shots.filter((sh) => sh.scene === "stock" && sh.stockQuery.trim()));
    const queries = [...new Set(stockShots.map((sh) => sh.stockQuery.trim().toLowerCase()))].slice(0, 10);
    const clips = await withTimeout(Promise.all(queries.map((q, n) => fetchStock(q, dir, n))), 90_000).catch(() => queries.map(() => null));
    const stockAsset = new Map<string, number>();
    clips.forEach((c, n) => {
      if (!c) return;
      assets.push({ url: fileUrl(id, c.file), kind: "video", width: c.width, height: c.height, durationSec: c.durationSec, label: c.label });
      stockAsset.set(queries[n], assets.length - 1);
    });
    for (const sh of stockShots) {
      const a = stockAsset.get(sh.stockQuery.trim().toLowerCase());
      sh.assetIndex = a ?? -1;
      if (a !== undefined) sh.clipStart = Math.max(0, sh.clipStart);
    }

    await updateJob(id, (j) => void (j.plan = plan));

    // People asking for this product now. Runs while the voices record; never fatal.
    void (async () => {
      await updateJob(id, (j) => void (j.peopleStatus = "finding"));
      try {
        const people = await findPeople(id, {
          url: site.url,
          name: plan.brand.name,
          ...plan.brief,
          niche: found.niche?.niche ?? null,
          audience: found.niche?.audience ?? null,
          competitors: found.niche?.competitors.map((c) => c.name) ?? [],
        });
        await updateJob(id, (j) => {
          j.people = people;
          j.peopleStatus = "done";
        });
      } catch (e) {
        console.error(`[job ${id}] people`, e);
        await updateJob(id, (j) => void (j.peopleStatus = "failed"));
      }
    })();

    await updateJob(id, (j) => void (j.step = "voicing"));
    const voiced = await Promise.all(
      plan.videos.map(async (script, i) => {
        const voiceFile = `voice-${i}.mp3`;
        const vo =
          script.voice === "clip" && spoken.length
            ? await clipVoiceover(script, spoken, dir, path.join(dir, voiceFile))
            : await makeVoiceover(script, path.join(dir, voiceFile));
        const props: VideoProps = {
          script,
          brand: plan.brand,
          logoUrl: site.logoFile ? fileUrl(id, site.logoFile) : null,
          assets,
          elements: site.elements,
          voiceUrl: fileUrl(id, voiceFile),
          musicUrl: null,
          captions: vo.captions,
          shotStartsMs: vo.shotStartsMs,
          durationMs: vo.durationMs,
        };
        return { props, render: { status: "none" as const } };
      }),
    );

    // Readable profile links: /<brand>/tiktok, /<brand>/instagram, /<brand>/youtube.
    const labels = new URL(site.url).hostname.split(".").slice(0, -1);
    const brand = (labels.filter((l) => !/^(www|store|shop|app|web|get|try|go|my|en|m)$/.test(l)).at(-1) ?? labels.at(-1) ?? "brand")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    const bioLinks = await Promise.all(
      (["tiktok", "reels", "shorts"] as const).map(async (channel) => {
        const label = { tiktok: "TikTok link in bio", reels: "Instagram link in bio", shorts: "YouTube link in bio" }[channel];
        const slug = `${brand}/${{ tiktok: "tiktok", reels: "instagram", shorts: "youtube" }[channel]}`;
        const { url: link } = await makeLink(id, { channel, label, target: site.url, slug }).catch(() => ({ url: site.url }));
        return { channel, url: link };
      }),
    );

    await updateJob(id, (j) => {
      j.videos = voiced;
      j.bioLinks = bioLinks;
      j.step = "ready";
    });
  } catch (err) {
    console.error(`[job ${id}]`, err);
    await updateJob(id, (j) => {
      j.step = "failed";
      j.error = err instanceof Error ? err.message : String(err);
    });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms))]);
}

type Prepared = {
  videos: Footage[];
  talks: { clip: Footage; phrases: Phrase[] }[];
  images: { file: string; width: number; height: number; label: string }[];
};
// One phrase of one talking clip, with its neighbours (cuts must not spill into them).
type Spoken = { clip: Footage; assetIndex: number; clipNo: number; phrases: Phrase[]; i: number; phrase: Phrase };

// Likely spellings of the product's name: the domain ("cubix.design" -> "Cubix") and
// the first part of the page title ("Cubix | AI video editor" -> "Cubix").
function brandTerms(url: string, title: string): string[] {
  const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
  const fromTitle = title.split(/[|:\-–—·]/)[0].trim();
  const terms = [host.charAt(0).toUpperCase() + host.slice(1), fromTitle]
    .map((t) => t.replace(/[<>{}[\]\\]/g, "").trim())
    .filter((t) => t && t.length < 50 && t.split(/\s+/).length <= 5);
  return [...new Set(terms)];
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i;

// Uploads were saved as upload-N.* when the job was created: photos, screen recordings,
// past videos. We sort them ourselves: someone talking to camera becomes a talking clip
// (transcribed, so their words can carry a video), anything else is product footage.
// Everything runs at once; nothing here is fatal.
async function prepareFootage(dir: string, siteVideoUrls: string[], keyterms: string[]): Promise<Prepared> {
  const uploads = (await readdir(dir)).filter((f) => /^upload-\d+\./.test(f)).sort().slice(0, 10);

  const fromUploads = Promise.all(
    uploads.map(async (f, i) => {
      if (IMAGE_EXT.test(f)) return { image: await prepImage(path.join(dir, f), path.join(dir, `photo-${i}.jpg`)) };
      const v = await prepVideo(path.join(dir, f), path.join(dir, `clip-${i}.mp4`), "");
      if (!v) return {};
      const [seen, words] = await Promise.all([describeFootage(dir, v, "upload"), v.hasAudio ? transcribe(dir, v, keyterms) : Promise.resolve([])]);
      // Any upload with real speech can carry a video in its own words: a fresh selfie,
      // or past UGC where someone talks for a few seconds and then it cuts to a demo.
      // Reusing a phrase replays that moment of the video, picture and sound together.
      if (words.length >= 12) {
        const what = seen.face ? "their video with someone talking to camera" : "their video with a voice speaking over it";
        return { talk: { clip: { ...v, captions: seen.captions, label: `${what}. ${seen.text}` }, phrases: toPhrases(words) } };
      }
      return { video: { ...v, label: `their own footage of the product. ${seen.text}` } };
    }),
  );

  const fromSite = (async () => {
    const vids = await grabSiteVideos(siteVideoUrls, dir, 3);
    return Promise.all(
      vids.map(async (v) => {
        const seen = await describeFootage(dir, v, "site");
        // a site video nobody can describe is usually decoration (a background loop)
        return seen.text ? { ...v, label: `a product video from their site (file "${v.source}"). ${seen.text}` } : null;
      }),
    );
  })();

  const [ups, siteVids] = await Promise.all([fromUploads, fromSite]);
  return {
    images: ups.flatMap((u) => ("image" in u && u.image ? [u.image] : [])),
    talks: ups.flatMap((u) => ("talk" in u && u.talk ? [u.talk] : [])),
    // their own footage first: it's the real product, the site's videos are often decoration
    videos: [...ups.flatMap((u) => ("video" in u && u.video ? [u.video] : [])), ...siteVids.filter((v): v is Footage => !!v)],
  };
}

// The writer's "clip" videos must point at real phrases, once each; anything else falls
// back to a written voiceover. Talk shots show the clip the phrase came from.
function fixVoice(v: Script, talk: TalkInfo) {
  v.voice ??= "ai";
  if (v.voice === "clip" && talk) {
    const used = new Set<number>();
    v.shots = v.shots.filter((sh) => {
      const ok = sh.phrase >= 0 && sh.phrase < talk.phrases.length && !used.has(sh.phrase);
      if (ok) {
        used.add(sh.phrase);
        sh.voiceLine = talk.phrases[sh.phrase].text;
        if (sh.scene === "talk") sh.assetIndex = talk.clips[talk.phrases[sh.phrase].clip].assetIndex;
      }
      return ok;
    });
    if (v.shots.length >= 2) return;
  }
  v.voice = "ai";
  for (const sh of v.shots) {
    sh.phrase = -1;
    if (sh.scene === "talk") sh.scene = "type";
  }
}

// Their own words as the voice: cut the chosen phrases out of their clips, in the
// writer's order, and time captions and shots from the transcript.
async function clipVoiceover(script: Script, spoken: Spoken[], dir: string, out: string) {
  const segs = script.shots.map((sh) => {
    const { clip, phrases, i, phrase: p } = spoken[sh.phrase];
    const lo = i > 0 ? phrases[i - 1].end + 0.01 : 0;
    const hi = i + 1 < phrases.length ? phrases[i + 1].start - 0.01 : clip.durationSec;
    return { src: path.join(dir, clip.file), start: Math.max(lo, p.start - 0.08), end: Math.min(hi, p.end + 0.14) };
  });
  await cutVoice(segs, out);

  const captions: Caption[] = [];
  const shotStartsMs: number[] = [];
  let offset = 0;
  script.shots.forEach((sh, i) => {
    const seg = segs[i];
    shotStartsMs.push(Math.round(offset * 1000));
    if (sh.scene === "talk") {
      sh.clipStart = seg.start;
      sh.assetIndex = spoken[sh.phrase].assetIndex;
    }
    for (const w of spoken[sh.phrase].phrase.words) {
      const startMs = Math.round((w.start - seg.start + offset) * 1000);
      const endMs = Math.round((w.end - seg.start + offset) * 1000);
      captions.push({ text: captions.length ? ` ${w.text}` : w.text, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: 1 });
    }
    offset += seg.end - seg.start;
  });
  return { captions, shotStartsMs, durationMs: Math.round(offset * 1000) + 120 };
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
