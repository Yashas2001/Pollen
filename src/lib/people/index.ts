import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { makeLink } from "@/lib/links";
import { hackerNews, linkedin, reddit, redditFromGoogle, type Candidate } from "./sources";
import type { Person, PeopleBrief } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 40_000 } });
const MODEL = "gemini-3.8-flash";
const MAX_CANDIDATES = 40;

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
    };
    const settled = await Promise.allSettled(Object.values(sources));
    const found: Candidate[] = [];
    settled.forEach((r, i) => {
      const name = Object.keys(sources)[i];
      if (r.status === "fulfilled") {
        console.log(`[people] ${name}: ${r.value.length} candidates`);
        found.push(...r.value);
      } else console.warn(`[people] ${name} failed:`, r.reason);
    });

    const candidates = clean(found, brief, search.terms).slice(0, MAX_CANDIDATES);
    if (!candidates.length) return [];

    const list = candidates.map((c, i) => `[${i}] ${PLATFORM_NAME[c.platform]}, by ${c.author}:\n${c.text}`).join("\n\n");
    const { results } = await ask(
      Scored,
      `${describe(brief)}

Below are recent posts. For each one, score 0 to 10: is this person asking for something this product does? 10 = they are clearly looking for exactly this kind of product. 0 = off-topic, an ad, someone promoting their own product, or a news/discussion post that asks for nothing.

For every post scoring 6 or more, also write:
- why: one line on why this person fits, e.g. "Asking for a Calendly alternative that's free for teams."
- reply: 2 to 4 sentences a real person would post under their own name. Helpful first: actually answer what they asked. Mention the product once by name, and put the literal text {link} where its link goes (exactly once; never write a URL yourself). No hype, no "Great question", no emojis, no exclamation marks.

Return JSON: {"results": [{"i": number, "score": number, "why": string, "reply": string}]} with one entry per post.

${list}`,
    );

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
        return { ...c, score: r.score, why: r.why, reply, linkCode: link.code || undefined };
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
