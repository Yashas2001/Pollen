// YouTube lookups for outreach: longer niche videos and channel details.
// Same official API and key as research.

const API = "https://www.googleapis.com/youtube/v3";
const searchCache = new Map<string, string[]>();

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY ?? "");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || data.error) throw new Error(`YouTube ${path}: ${data.error?.message ?? res.status}`);
  return data;
}

// Longer videos (4-20 min: reviews, tutorials) for a phrase in the last year. 100 units.
export async function searchVideos(query: string, max = 25): Promise<string[]> {
  const key = `long|${query.toLowerCase()}|${max}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const data = await yt<{ items: { id: { videoId: string } }[] }>("search", {
    part: "id",
    type: "video",
    videoDuration: "medium",
    order: "relevance",
    publishedAfter: since,
    maxResults: String(max),
    q: query,
  });
  const ids = data.items.map((i) => i.id.videoId).filter(Boolean);
  searchCache.set(key, ids);
  return ids;
}

export type Channel = {
  id: string;
  title: string;
  handle: string | null; // "@name"
  description: string;
  subscribers: number | null; // null when the channel hides it
  videoCount: number;
  thumbnail: string;
};

// Channel details, 50 per call, 1 unit each call.
export async function getChannels(ids: string[]): Promise<Channel[]> {
  const out: Channel[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt<{
      items?: {
        id: string;
        snippet: { title: string; description: string; customUrl?: string; thumbnails: Record<string, { url: string }> };
        statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
      }[];
    }>("channels", { part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") });
    for (const c of data.items ?? []) {
      const t = c.snippet.thumbnails;
      out.push({
        id: c.id,
        title: c.snippet.title,
        handle: c.snippet.customUrl ?? null,
        description: c.snippet.description ?? "",
        subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
        videoCount: Number(c.statistics.videoCount ?? 0),
        thumbnail: (t.medium ?? t.default)?.url ?? "",
      });
    }
  }
  return out;
}
