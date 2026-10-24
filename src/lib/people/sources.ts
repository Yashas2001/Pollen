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

// Google, through Bright Data's SERP API. tbs=qdr:w / qdr:m = past week / month only.
// LinkedIn results come back as google.com/goto redirects; the Location header is the real post.
async function google(query: string, tbs: "qdr:w" | "qdr:m"): Promise<{ url: string; snippet: string }[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=${tbs}&brd_json=1&num=25`;
  const deadline = AbortSignal.timeout(45_000); // hard cut-off for all attempts; googleAll keeps what arrived
  let res: Response | undefined;
  // Bright Data answers 200 with an empty body and an x-brd-error header when it refuses a request
  // (e.g. our outgoing IP is on the zone's denylist). Refusals are fast, and the venue network
  // rotates IPs, so try up to 3 times.
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone: process.env.BRIGHTDATA_SERP_ZONE ?? "viskara_serp", url, format: "raw" }),
      signal: deadline,
    });
    if (!res.headers.get("x-brd-error")) break;
  }
  if (!res?.ok || res.headers.get("x-brd-error"))
    throw new Error(`bright data: ${res?.headers.get("x-brd-err-msg") ?? res?.headers.get("x-brd-error") ?? res?.status}`);
  const { organic = [] } = (await res.json()) as { organic?: { link: string; title?: string; description?: string }[] };
  const links = await Promise.allSettled(
    organic.map(async (o) => ({
      url: o.link.includes("google.com/goto")
        ? (await fetch(o.link, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) })).headers.get("location") ?? ""
        : o.link,
      snippet: [o.title, o.description?.replace(/\s*Read more$/, "")].filter(Boolean).join("\n"),
    })),
  );
  return links.flatMap((l) => (l.status === "fulfilled" && l.value.url ? [l.value] : []));
}

// Run several searches at once; one failing doesn't drop the others.
async function googleAll(queries: string[], tbs: "qdr:w" | "qdr:m") {
  const results = await Promise.allSettled(queries.map((q) => google(q, tbs)));
  results.forEach((r, i) => r.status === "rejected" && console.warn(`[people] google "${queries[i]}":`, r.reason?.message ?? r.reason));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// Reddit threads Google found, then the real post (author, text, date) from Arctic Shift.
export async function redditFromGoogle(phrases: string[]): Promise<Candidate[]> {
  const hits = await googleAll(phrases.slice(0, 4).map((p) => `site:reddit.com ${p}`), "qdr:w");
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
      text: `${p.title}
${p.selftext ?? ""}`.trim(),
      postedAt: new Date(p.created_utc * 1000).toISOString(),
    }));
}

// LinkedIn has no search API. Only post links with an activity id count; the id holds the post time.
export async function linkedin(queries: string[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const h of await googleAll(queries, "qdr:m")) {
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

// X posts Google found this week. The tweet id holds the post time (Twitter epoch).
export async function x(phrases: string[], terms: string[]): Promise<Candidate[]> {
  const words = terms.map((t) => t.toLowerCase());
  const out: Candidate[] = [];
  for (const h of await googleAll(phrases.slice(0, 4).map((p) => `site:x.com ${p}`), "qdr:w")) {
    const m = h.url.match(/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/);
    if (!m) continue;
    const posted = new Date(Number(BigInt(m[2]) >> BigInt(22)) + 1288834974657);
    // Same cheap filter as Reddit before any AI: this week, sounds like a question, mentions the niche.
    const lower = h.snippet.toLowerCase();
    if (posted.getTime() < Date.now() - 7 * DAY * 1000 || !ASKING.test(h.snippet) || !words.some((w) => lower.includes(w))) continue;
    out.push({ platform: "x", url: `https://x.com/${m[1]}/status/${m[2]}`, author: `@${m[1]}`, text: h.snippet, postedAt: posted.toISOString() });
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
