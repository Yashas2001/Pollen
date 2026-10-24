import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { makeLink } from "@/lib/links";
import { hackerNews, linkedin, reddit, redditFromGoogle, x, type Candidate } from "./sources";
import type { Person, PeopleBrief } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 40_000 } });
const MODEL = "gemini-3.8-flash";
// Per-source share of the candidates sent for scoring, so one noisy source can't crowd out the rest.
const BATCH = 15;
const CAP: Record<string, number> = { google_reddit: 20, x: 15, reddit: 15, linkedin: 5, hn: 5 }; // 60 to Gemini

const Search = z.object({
  phrases: z.array(z.string()),
  keywords: z.array(z.string()),
  terms: z.array(z.string()),
  subreddits: z.array(z.string()),
  linkedin: z.array(z.string()),
});

const Scored = z.object({
  results: z.array(z.object({ i: z.number(), score: z.number(), why: z.string(), reply: z.string() })),
});

const PLATFORM_NAME = { reddit: "Reddit", hn: "Hacker News", linkedin: "LinkedIn", x: "X" } as const;

async function ask<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  return schema.parse(JSON.parse(res.text ?? ""));
}

const describe = (b: PeopleBrief) => `Product: ${b.url}
What it is: ${b.what}
Who it's for: ${b.who}
Pain it solves: ${b.pain}
Niche: ${b.niche ?? "unknown"}
Audience: ${b.audience ?? "unknown"}
Competitors: ${b.competitors.join(", ") || "none known"}`;

// Finds real, recent posts (last 7 days) from people asking for what this product does,
// scores them, and drafts a reply for each. Never posts anything. Never throws: returns [].
export async function findPeople(jobId: string, brief: PeopleBrief): Promise<Person[]> {
  try {
    const search = await ask(
      Search,
      `${describe(brief)}

We want to find people online who are asking for what this product does, right now.
- phrases: 5 to 8 phrases the way a buyer would actually type them in a post, not marketing words. E.g. "any tool that...", "how do I...", "alternative to <competitor>", "recommend a ...".
- keywords: 4 to 6 short search terms (1 to 3 words) for a keyword search engine, e.g. "calendly alternative", "scheduling tool". Include "<competitor> alternative" for the main competitors.
- terms: 6 to 10 single lowercase words specific to this niche that a relevant post would contain (product category words and competitor names, e.g. "calendly", "scheduling", "booking"). No generic words like "tool", "app", "best", "help".
- subreddits: 6 to 10 real, active subreddit names (no "r/") where this audience asks for help or tool recommendations. Prefer niche subreddits about this exact problem or category over general business ones.
- linkedin: 3 Google queries that find LinkedIn posts of people asking for this, e.g. site:linkedin.com/posts "looking for" <niche>, site:linkedin.com/posts "any recommendations" <problem>.`,
    );
    console.log("[people] search", search);

    const sources = {
      google_reddit: redditFromGoogle(search.phrases),
      reddit: reddit(search.subreddits, search.terms),
      hn: hackerNews(search.keywords),
      linkedin: linkedin(search.linkedin),
      x: x(search.phrases, search.terms),
    };
    const settled = await Promise.allSettled(Object.values(sources));
    const found: Candidate[] = [];
    settled.forEach((r, i) => {
      const name = Object.keys(sources)[i];
      if (r.status === "fulfilled") {
        console.log(`[people] ${name}: ${r.value.length} candidates`);
        found.push(...clean(r.value, brief, search.terms).slice(0, CAP[name]));
      } else console.warn(`[people] ${name} failed:`, r.reason);
    });

    const candidates = found.filter((c, k) => found.findIndex((o) => o.url === c.url) === k);
    if (!candidates.length) return [];

    // Scored in parallel batches: one call with 40+ posts runs past Gemini's deadline.
    const batches = Array.from({ length: Math.ceil(candidates.length / BATCH) }, (_, b) => b * BATCH);
    const scored = await Promise.allSettled(
      batches.map(async (offset) => {
        const list = candidates
          .slice(offset, offset + BATCH)
          .map((c, i) => `[${offset + i}] ${PLATFORM_NAME[c.platform]}, by ${c.author}:\n${c.text}`)
          .join("\n\n");
        return (await ask(
          Scored,
          `${describe(brief)}

Below are recent posts. For each one, score 0 to 10: is this person asking for something this product does? 10 = they are clearly looking for exactly this kind of product. 0 = off-topic, an ad, someone promoting their own product, or a news/discussion post that asks for nothing.

For every post scoring 6 or more, also write:
- why: one line on why this person fits, e.g. "Asking for a Calendly alternative that's free for teams."
- reply: 2 to 4 sentences a real person would post under their own name. Helpful first: actually answer what they asked. Mention the product once by name, and put the literal text {link} where its link goes (exactly once; never write a URL yourself). No hype, no "Great question", no emojis, no exclamation marks.

Return JSON: {"results": [{"i": number, "score": number, "why": string, "reply": string}]} with one entry per post.

${list}`,
        )).results;
      }),
    );
    scored.forEach((r) => r.status === "rejected" && console.warn("[people] scoring batch failed:", r.reason?.message ?? r.reason));
    const results = scored.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    console.log("[people] scores", results.map((r) => r.score).join(" "));
    const best = results
      .filter((r) => r.score >= 6 && candidates[r.i])
      .sort((a, b) => b.score - a.score)
      .filter((r, k, all) => all.findIndex((o) => o.i === r.i) === k)
      .slice(0, 10);

    return await Promise.all(
      best.map(async (r) => {
        const c = candidates[r.i];
        const link = await makeLink(jobId, { channel: c.platform, label: `Reply to ${c.author} on ${PLATFORM_NAME[c.platform]}`, target: brief.url });
        const reply = r.reply.includes("{link}") ? r.reply.replace("{link}", link.url).replaceAll("{link}", "") : `${r.reply} ${link.url}`;
        const tweetId = c.platform === "x" ? c.url.split("/status/")[1] : undefined;
        const replyUrl = tweetId ? `https://x.com/intent/post?in_reply_to=${tweetId}&text=${encodeURIComponent(reply)}` : undefined;
        return { ...c, score: r.score, why: r.why, reply, replyUrl, linkCode: link.code || undefined };
      }),
    );
  } catch (e) {
    console.error("[people] failed", e);
    return [];
  }
}

// Same post twice, the product's or a competitor's own posts, and long walls of text.
// Most on-topic first (how many niche terms it mentions), then newest.
function clean(found: Candidate[], brief: PeopleBrief, terms: string[]): Candidate[] {
  const host = new URL(brief.url).hostname.replace(/^www\./, "").split(".")[0];
  const brands = [host, ...brief.competitors].map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((n) => n.length > 2);
  const seen = new Set<string>();
  return found
    .filter((c) => {
      const author = c.author.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(c.url) || brands.some((b) => author.includes(b))) return false;
      seen.add(c.url);
      return true;
    })
    .map((c) => ({ ...c, text: c.text.length > 500 ? `${c.text.slice(0, 500)}...` : c.text }))
    .map((c) => ({ c, hits: terms.filter((t) => c.text.toLowerCase().includes(t.toLowerCase())).length }))
    .sort((a, b) => b.hits - a.hits || b.c.postedAt.localeCompare(a.c.postedAt))
    .map(({ c }) => c);
}
