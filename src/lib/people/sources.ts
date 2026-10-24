import { GoogleGenAI } from "@google/genai";
import type { Platform } from "./types";

// A raw post from one source, before scoring.
export type Candidate = { platform: Platform; url: string; author: string; text: string; postedAt: string };

const DAY = 86_400;
const TIMEOUT = 10_000;
const now = () => Math.floor(Date.now() / 1000);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { "User-Agent": "vibe-people-finder/0.1" } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

// Reddit's own search.json now redirects to a login page (reason=lor2), so we read
// Arctic Shift, a public near-real-time Reddit archive. Its full-text search times out,
// so we list each subreddit's last week and keep posts that look like a question.
const ASKING = /\?|looking for|recommend|alternative|any (good )?(tool|app|software)|how (do|can|to)|suggestions?|need (a|an|help)|best (way|tool|app)/i;

export async function reddit(subreddits: string[], terms: string[]): Promise<Candidate[]> {
  const words = terms.map((t) => t.toLowerCase());
  const lists = await Promise.allSettled(
    subreddits.map((s) =>
      getJson<{ data: { id: string; title: string; selftext?: string; author: string; created_utc: number; subreddit: string }[] | null; error?: string }>(
        `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(s)}&after=${now() - 7 * DAY}&limit=100&sort=desc&fields=id,title,selftext,author,created_utc,subreddit`,
      ),
    ),
  );
  const out: Candidate[] = [];
  lists.forEach((r, i) => {
    if (r.status === "rejected") return console.warn(`[people] reddit r/${subreddits[i]}:`, r.reason?.message ?? r.reason);
    for (const p of r.value.data ?? []) {
      const text = `${p.title}\n${p.selftext ?? ""}`.trim();
      const lower = text.toLowerCase();
      if (p.author === "[deleted]" || !ASKING.test(text) || !words.some((w) => lower.includes(w))) continue;
      out.push({
        platform: "reddit",
        url: `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/`,
        author: p.author,
        text,
        postedAt: new Date(p.created_utc * 1000).toISOString(),
      });
    }
  });
  return out;
}

// Google, through Gemini's search tool. Links come only from grounding metadata:
// URLs the model writes in its own text are often invented.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 40_000 } });
const after = (days: number) => `after:${new Date(Date.now() - days * DAY * 1000).toISOString().slice(0, 10)}`;

async function google(queries: string[]): Promise<{ url: string; snippet: string }[]> {
  const res = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: `Search Google for each of these queries and briefly list the posts you find (who is asking, what for):\n${queries.map((q) => `- ${q}`).join("\n")}`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const meta = res.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks ?? [];
  const snippets = chunks.map(() => [] as string[]);
  for (const s of meta?.groundingSupports ?? []) for (const i of s.groundingChunkIndices ?? []) if (s.segment?.text) snippets[i]?.push(s.segment.text);
  const links = await Promise.allSettled(
    chunks.map(async (c, i) => {
      const uri = c.web?.uri ?? "";
      // Grounding links are Google redirects; the Location header is the real page.
      const real = uri.includes("grounding-api-redirect")
        ? (await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) })).headers.get("location") ?? ""
        : uri;
      return { url: real, snippet: [c.web?.title, ...snippets[i]].filter(Boolean).join(" ") };
    }),
  );
  return links.flatMap((l) => (l.status === "fulfilled" && l.value.url ? [l.value] : []));
}

// Reddit threads Google found, then the real post (author, text, date) from Arctic Shift.
export async function redditFromGoogle(phrases: string[]): Promise<Candidate[]> {
  const hits = await google(phrases.slice(0, 5).map((p) => `site:reddit.com ${p} ${after(7)}`));
  const ids = [...new Set(hits.flatMap((h) => h.url.match(/reddit\.com\/r\/\w+\/comments\/(\w+)/)?.[1] ?? []))];
  if (!ids.length) return [];
  const { data } = await getJson<{ data: { id: string; title: string; selftext?: string; author: string; created_utc: number; subreddit: string }[] | null }>(
    `https://arctic-shift.photon-reddit.com/api/posts/ids?ids=${ids.join(",")}&fields=id,title,selftext,author,created_utc,subreddit`,
  );
  return (data ?? [])
    .filter((p) => p.created_utc > now() - 7 * DAY && p.author !== "[deleted]")
    .map((p) => ({
      platform: "reddit" as const,
      url: `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/`,
      author: p.author,
      text: `${p.title}\n${p.selftext ?? ""}`.trim(),
      postedAt: new Date(p.created_utc * 1000).toISOString(),
    }));
}

// LinkedIn has no search API. Only post links with an activity id count; the id holds the post time.
export async function linkedin(queries: string[]): Promise<Candidate[]> {
  const hits = await google(queries.map((q) => `${q} ${after(30)}`));
  const out: Candidate[] = [];
  for (const h of hits) {
    const id = h.url.match(/activity[-:](\d{16,20})/)?.[1];
    if (!id || !h.url.includes("linkedin.com")) continue;
    const posted = new Date(Number(BigInt(id) >> BigInt(22)));
    if (posted.getTime() < Date.now() - 30 * DAY * 1000) continue;
    out.push({
      platform: "linkedin",
      url: h.url.split("?")[0],
      author: h.url.match(/linkedin\.com\/posts\/([^_/]+)/)?.[1] ?? "someone on LinkedIn",
      text: h.snippet,
      postedAt: posted.toISOString(),
    });
  }
  return out;
}

const decode = (html: string) =>
  html
    .replace(/<p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

export async function hackerNews(keywords: string[]): Promise<Candidate[]> {
  const results = await Promise.allSettled(
    keywords.map((k) =>
      getJson<{ hits: { objectID: string; title?: string; story_text?: string; comment_text?: string; author: string; created_at: string }[] }>(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(k)}&tags=(story,comment)&numericFilters=created_at_i>${now() - 7 * DAY}&hitsPerPage=20`,
      ),
    ),
  );
  const out: Candidate[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") return console.warn(`[people] hn "${keywords[i]}":`, r.reason?.message ?? r.reason);
    for (const h of r.value.hits)
      out.push({
        platform: "hn",
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        author: h.author,
        text: decode([h.title, h.story_text, h.comment_text].filter(Boolean).join("\n")).trim(),
        postedAt: h.created_at,
      });
  });
  return out;
}
