import path from "node:path";
import type { Asset, VideoProps } from "@/remotion/schema";
import { readSite } from "./site";
import { planVideos } from "./writer";
import { research } from "./research";
import type { Research } from "./research/types";
import { makeVoiceover } from "./voice";
import { fileUrl, jobDir, updateJob } from "./jobs";
import { findPeople } from "./people";

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

    await updateJob(id, (j) => void (j.step = "writing"));
    const plan = await planVideos(site, path.join(dir, site.heroFile), assets, site.elements, found.outliers);
    // The writer sometimes points at an image or page part that doesn't exist; drop those links.
    for (const v of plan.videos)
      for (const sh of v.shots) {
        if (!assets[sh.assetIndex]) sh.assetIndex = -1;
        if (!assets[sh.secondAssetIndex]) sh.secondAssetIndex = -1;
        if (!site.elements[sh.elementIndex]) sh.elementIndex = -1;
      }
    await updateJob(id, (j) => void (j.plan = plan));

    // People asking for this product now. Runs while the voices record; never fatal.
    void (async () => {
      await updateJob(id, (j) => void (j.peopleStatus = "finding"));
      try {
        const people = await findPeople(id, {
          url: site.url,
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
        const vo = await makeVoiceover(script, path.join(dir, voiceFile));
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

    await updateJob(id, (j) => {
      j.videos = voiced;
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
