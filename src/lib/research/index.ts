import type { Niche, Outlier, Research } from "./types";
import { findNiche, keepRelevant, watchRecipe } from "./gemini";
import { SHORT_LIMIT, channelUploads, getVideos, median, recentShorts, searchShorts, type Video } from "./youtube";

// An outlier is a Short that beat its OWN channel's usual views by a lot, so a
// big channel getting its normal numbers doesn't count, a small one breaking out does.
const MIN_MULTIPLE = 3;
const MIN_MULTIPLE_COMPETITOR = 2; // a competitor's own best posts are worth seeing even at 2x
const MAX_MULTIPLE_FOR_RANKING = 50; // 400M-view brand ads are paid reach, not a better format
const MIN_VIEWS = 5_000;
const MIN_BASELINE_SHORTS = 5;
const WATCH_TOP = 3;
const MAX_SEARCH_QUERIES = 2; // 100 quota units each
const MAX_SEARCH_CHANNELS = 8;

type Scored = Outlier;

function score(videos: Video[], source: string, minMultiple = MIN_MULTIPLE): Scored[] {
  if (videos.length < MIN_BASELINE_SHORTS) return [];
  const base = median(videos.map((v) => v.views));
  if (base <= 0) return [];
  return videos
    .map((v) => ({
      platform: "youtube" as const,
      videoId: v.id,
      url: `https://www.youtube.com/shorts/${v.id}`,
      title: v.title,
      channel: v.channelTitle,
      channelId: v.channelId,
      thumbnail: v.thumbnail,
      views: v.views,
      channelMedianViews: Math.round(base),
      multiple: Math.round((v.views / base) * 10) / 10,
      durationSeconds: v.durationSeconds,
      publishedAt: v.publishedAt,
      source,
    }))
    .filter((o) => o.multiple >= minMultiple && o.views >= MIN_VIEWS);
}

async function fromCompetitors(niche: Niche, notes: string[]): Promise<Scored[]> {
  const handles = niche.competitors.filter((c) => c.youtubeHandle.trim()).slice(0, 5);
  const results = await Promise.all(
    handles.map(async (c) => {
      try {
        const ch = await channelUploads({ handle: c.youtubeHandle.trim() });
        if (!ch) return [];
        return score(await recentShorts(ch.uploads, 40), `competitor: ${c.name}`, MIN_MULTIPLE_COMPETITOR);
      } catch (e) {
        notes.push(`competitor ${c.name}: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  return results.flat();
}

async function fromSearch(niche: Niche, notes: string[]): Promise<Scored[]> {
  const ids = new Set<string>();
  for (const q of niche.queries.slice(0, MAX_SEARCH_QUERIES)) {
    try {
      (await searchShorts(q)).forEach((id) => ids.add(id));
    } catch (e) {
      notes.push(`search "${q}": ${(e as Error).message}`);
    }
  }
  if (!ids.size) return [];
  const hits = (await getVideos([...ids])).filter((v) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_LIMIT);
  // The biggest hits' channels, one entry each, then judge each hit against its own channel.
  const byChannel = new Map<string, Video>();
  for (const v of hits.sort((a, b) => b.views - a.views)) if (!byChannel.has(v.channelId)) byChannel.set(v.channelId, v);
  const channels = [...byChannel.keys()].slice(0, MAX_SEARCH_CHANNELS);
  const results = await Promise.all(
    channels.map(async (id) => {
      try {
        const ch = await channelUploads({ id });
        if (!ch) return [];
        const recent = await recentShorts(ch.uploads, 30);
        const hit = byChannel.get(id)!;
        const pool = recent.some((v) => v.id === hit.id) ? recent : [...recent, hit];
        return score(pool, "search").filter((o) => o.videoId === hit.id);
      } catch (e) {
        notes.push(`channel ${id}: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  return results.flat();
}

export async function research(
  site: { url: string; title: string; description: string; text: string },
  // Called as results land, so the waiting screen can show them.
  onProgress: (partial: Research) => Promise<void> = async () => {},
): Promise<Research> {
  const notes: string[] = [];
  let niche: Niche | null = null;
  try {
    niche = await findNiche(site);
  } catch (e) {
    notes.push(`niche: ${(e as Error).message}`);
    return { niche: null, outliers: [], notes };
  }
  await onProgress({ niche, outliers: [], notes });

  const [comp, search] = await Promise.all([fromCompetitors(niche, notes), fromSearch(niche, notes)]);

  // Off-topic hits out, then best per channel. Competitors first (closest to the
  // product), then the niche, each by how far it beat its own channel.
  let relevant = [...comp, ...search];
  try {
    const keep = await keepRelevant(niche, relevant);
    relevant = relevant.filter((o) => keep.has(o.videoId));
  } catch (e) {
    notes.push(`relevance: ${(e as Error).message}`);
  }
  const rank = (o: Outlier) => (o.source.startsWith("competitor") ? 1000 : 0) + Math.min(o.multiple, MAX_MULTIPLE_FOR_RANKING);
  const best = new Map<string, Outlier>();
  for (const o of relevant.sort((a, b) => rank(b) - rank(a))) {
    if (!best.has(o.channelId)) best.set(o.channelId, o);
  }
  const outliers = [...best.values()].slice(0, 8);
  await onProgress({ niche, outliers, notes });

  // Watch the top ones and pull out their recipes.
  await Promise.all(
    outliers.slice(0, WATCH_TOP).map(async (o) => {
      try {
        o.recipe = await watchRecipe(o.url, o.title);
      } catch (e) {
        notes.push(`watch ${o.videoId}: ${(e as Error).message}`);
      }
    }),
  );

  return { niche, outliers, notes };
}
