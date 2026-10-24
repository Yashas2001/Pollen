// YouTube Data API v3. Official, works everywhere, and Gemini can watch the
// result straight from its URL. Quota: search costs 100 units, everything else 1,
// default 10,000/day, so searches are capped and cached.

import { mkdir, readFile, writeFile } from "node:fs/promises";

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

// Search results kept on disk for 3 days, so restarts and repeat niches cost nothing.
const CACHE_FILE = "data/cache/youtube-search.json";
const CACHE_DAYS = 3;
let searchCache: Map<string, { at: number; ids: string[] }> | null = null;

async function loadCache() {
  if (searchCache) return searchCache;
  try {
    searchCache = new Map(Object.entries(JSON.parse(await readFile(CACHE_FILE, "utf8"))));
  } catch {
    searchCache = new Map();
  }
  return searchCache;
}

export async function cachedSearch(key: string, run: () => Promise<string[]>): Promise<string[]> {
  const cache = await loadCache();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_DAYS * 864e5) return hit.ids;
  const ids = await run();
  cache.set(key, { at: Date.now(), ids });
  await mkdir("data/cache", { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)));
  return ids;
}

// Most-viewed Shorts for a phrase in the last ~6 months.
export async function searchShorts(query: string, max = 15): Promise<string[]> {
  return cachedSearch(`short|${query.toLowerCase()}|${max}`, () => runSearchShorts(query, max));
}

// When the API search is out of quota (search has its own small daily limit), read
// YouTube's own search page instead: same results people see, no quota. Views are
// checked after with videos.list (1 unit), so order here doesn't matter.
const PAGE_FILTER = { shorts: "EgIQCQ%3D%3D", medium: "EgIYAw%3D%3D" }; // Shorts / 4-20 min

export async function pageSearch(query: string, kind: keyof typeof PAGE_FILTER, max: number): Promise<string[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${PAGE_FILTER[kind]}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "SOCS=CAI; CONSENT=YES+1", // skip the EU cookie wall
    },
    signal: AbortSignal.timeout(20_000),
  });
  const html = await res.text();
  const re = kind === "shorts" ? /\/shorts\/([A-Za-z0-9_-]{11})/g : /"videoId":"([A-Za-z0-9_-]{11})"/g;
  const ids = [...new Set([...html.matchAll(re)].map((m) => m[1]))].slice(0, max);
  if (!ids.length) throw new Error(`YouTube page search: no results (${res.status})`);
  return ids;
}

// API first (sorted by views), the search page if that fails.
export async function withPageFallback(query: string, kind: keyof typeof PAGE_FILTER, max: number, api: () => Promise<string[]>) {
  try {
    return await api();
  } catch (e) {
    console.warn(`[youtube] ${(e as Error).message.slice(0, 120)}; using search page`);
    return pageSearch(query, kind, max);
  }
}

async function runSearchShorts(query: string, max: number): Promise<string[]> {
  return withPageFallback(query, "shorts", max, () => apiSearchShorts(query, max));
}

async function apiSearchShorts(query: string, max: number): Promise<string[]> {
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
  return data.items.map((i) => i.id.videoId).filter(Boolean);
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

// The channel's recent uploads (newest first, any length), with stats. 2 units.
export async function recentUploads(uploadsPlaylist: string, max = 30): Promise<Video[]> {
  const data = await yt<{ items: { contentDetails: { videoId: string } }[] }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylist,
    maxResults: String(Math.min(max, 50)),
  });
  return getVideos(data.items.map((i) => i.contentDetails.videoId));
}

export const isShort = (v: Video) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_SECONDS;

// The channel's recent Shorts (newest first), with stats.
export async function recentShorts(uploadsPlaylist: string, max = 30): Promise<Video[]> {
  return (await recentUploads(uploadsPlaylist, max)).filter(isShort);
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const SHORT_LIMIT = SHORT_MAX_SECONDS;
export type { Video };
