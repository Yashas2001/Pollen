// YouTube Data API v3. Official, works everywhere, and Gemini can watch the
// result straight from its URL. Quota: search costs 100 units, everything else 1,
// default 10,000/day, so searches are capped and cached.

const API = "https://www.googleapis.com/youtube/v3";
const SHORT_MAX_SECONDS = 75;

type Video = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  views: number;
  durationSeconds: number;
  publishedAt: string;
};

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY ?? "");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || data.error) throw new Error(`YouTube ${path}: ${data.error?.message ?? res.status}`);
  return data;
}

function isoDurationSeconds(iso: string | undefined): number {
  const m = (iso ?? "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

type VideosResponse = {
  items: {
    id: string;
    snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: Record<string, { url: string }> };
    statistics: { viewCount?: string };
    contentDetails?: { duration?: string };
  }[];
};

export async function getVideos(ids: string[]): Promise<Video[]> {
  const out: Video[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt<VideosResponse>("videos", {
      part: "snippet,statistics,contentDetails",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const v of data.items) {
      const t = v.snippet.thumbnails;
      out.push({
        id: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        thumbnail: (t.high ?? t.medium ?? t.default)?.url ?? "",
        views: Number(v.statistics.viewCount ?? 0),
        durationSeconds: isoDurationSeconds(v.contentDetails?.duration),
        publishedAt: v.snippet.publishedAt,
      });
    }
  }
  return out;
}

const searchCache = new Map<string, string[]>();

// Most-viewed Shorts for a phrase in the last ~6 months.
export async function searchShorts(query: string, max = 15): Promise<string[]> {
  const key = `${query.toLowerCase()}|${max}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  const since = new Date(Date.now() - 180 * 864e5).toISOString();
  const data = await yt<{ items: { id: { videoId: string } }[] }>("search", {
    part: "id",
    type: "video",
    videoDuration: "short",
    order: "viewCount",
    publishedAfter: since,
    maxResults: String(max),
    q: query,
  });
  const ids = data.items.map((i) => i.id.videoId).filter(Boolean);
  searchCache.set(key, ids);
  return ids;
}

// A channel's uploads playlist id, by "@handle" or channel id.
export async function channelUploads(by: { handle?: string; id?: string }): Promise<{ id: string; title: string; uploads: string } | null> {
  const params: Record<string, string> = { part: "contentDetails,snippet" };
  if (by.handle) params.forHandle = by.handle.startsWith("@") ? by.handle : `@${by.handle}`;
  else if (by.id) params.id = by.id;
  else return null;
  const data = await yt<{ items?: { id: string; snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>("channels", params);
  const c = data.items?.[0];
  return c ? { id: c.id, title: c.snippet.title, uploads: c.contentDetails.relatedPlaylists.uploads } : null;
}

// The channel's recent Shorts (newest first), with stats.
export async function recentShorts(uploadsPlaylist: string, max = 30): Promise<Video[]> {
  const data = await yt<{ items: { contentDetails: { videoId: string } }[] }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylist,
    maxResults: String(Math.min(max, 50)),
  });
  const videos = await getVideos(data.items.map((i) => i.contentDetails.videoId));
  return videos.filter((v) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_SECONDS);
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const SHORT_LIMIT = SHORT_MAX_SECONDS;
export type { Video };
