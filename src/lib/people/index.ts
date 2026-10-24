import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { coach } from "./coach";
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

const describe = (b: PeopleBrief) => `Product: ${b.name || b.url} (${b.url})
What it is: ${b.what}
Who it's for: ${b.who}
Pain it solves: ${b.pain}
Niche: ${b.niche ?? "unknown"}
Audience: ${b.audience ?? "unknown"}
Competitors: ${b.competitors.join(", ") || "none known"}`;

const ASK_REPLY = `- reply: 2 to 4 sentences a real person would post under their own name in that thread. Helpful first: actually answer what they asked with something useful on its own (a tip, how to approach it, other options worth trying, competitors included when that's honest). Then mention the product once by its name, saying plainly that you build it (e.g. "I'm building <name>, which does..."); never pretend to be a happy user. No link and no URL: most communities remove them and ban self-promotion links. If it fits, end with something like "happy to share it if useful". Casual, no hype, no "Great question", no emojis, no exclamation marks.`;

const ENOUGH = 3; // fewer people asking than this -> look wider, and show where buyers talk

type Angle = "asking" | "wider" | "talking";

// What each round looks for. "asking" always runs; the other two only when too few are asking.
const LOOK: Record<Angle, { days: number; find: string; score: string; why: string; reply: string }> = {
  asking: {
    days: 7,
    find: "people who are asking for what this product does or sells, right now",
    score: `is this person asking for something this product does or sells? 10 = they are clearly looking for exactly this kind of product (a tool, a service or a thing to buy). 0 = off-topic, an ad, someone promoting their own product, or a news/discussion post that asks for nothing.`,
    why: `one line on why this person fits, e.g. "Asking for a Calendly alternative that's free for teams."`,
    reply: ASK_REPLY,
  },
  wider: {
    days: 30,
    find: "people asking about this product's category or the problem it solves, even if they never name this kind of brand: asking for the best option in the category, stuck on the problem, shopping for a gift it fits, or unhappy with a competitor and looking around. Few people asked directly this week, so cast wider than the obvious phrases",
    score: `is this person looking for something this product could honestly be the answer to? 10 = clearly looking for exactly this kind of thing. 0 = off-topic, an ad, someone promoting their own product, or a post that asks for nothing.`,
    why: `one line on why this person fits, e.g. "Wants a gift for an F1 fan under $100."`,
    reply: ASK_REPLY,
  },
  talking: {
    days: 30,
    find: "live conversations where this product's likely buyers talk about its topic (opinions, reviews, questions about the topic), even if nobody is asking to buy",
    score: `is this a live conversation among this product's likely buyers about its topic, where a helpful reply from the founder would be welcome? 10 = exactly its buyers, on its topic, open to replies. 0 = off-topic, an ad, a news repost, or a thread where any reply from a brand would look like spam.`,
    why: `one line on why this thread is worth joining, e.g. "F1 fans comparing team jackets before race weekend."`,
    reply: `- reply: 2 to 4 sentences a real person would post under their own name in that thread that add something real to the conversation (an opinion, a tip, a useful fact). Do not pitch. Mention the product only if it truly fits, at most once, saying plainly that you build it. No link and no URL. Casual, no hype, no "Great question", no emojis, no exclamation marks.`,
  },
};

// Finds real, recent posts from people asking for what this product does or sells, scores them,
// and drafts a reply for each. If fewer than ENOUGH are asking this week, it also looks wider
// (category, problem, gifts, competitors, last 30 days) and adds threads where its buyers talk,
// marked "talking" so the page never passes them off as people asking. Never posts anything.
// Never throws: returns [].
export async function findPeople(_jobId: string, brief: PeopleBrief): Promise<Person[]> {
  const host = new URL(brief.url).hostname.replace(/^www\./, "");
  try {
    const asking = await round(brief, "asking");
    if (asking.length >= ENOUGH) return await coach(asking, host);

    const [wider, talking] = await Promise.all([
      round(brief, "wider").catch(() => [] as Person[]),
      round(brief, "talking").catch(() => [] as Person[]),
    ]);
    const seen = new Set(asking.map((p) => p.url));
    const more = wider.filter((p) => !seen.has(p.url) && !!seen.add(p.url));
    const all = [...asking, ...more].slice(0, 10);
    const talk = all.length >= ENOUGH ? [] : talking.filter((p) => !seen.has(p.url)).slice(0, 8);
    console.log(`[people] asking ${asking.length}, wider ${more.length}, talking ${talk.length}`);
    // The Reply Coach skips posts that aren't asking, so only asking replies go through it.
    return [...(await coach(all, host)), ...talk];
  } catch (e) {
    console.error("[people] failed", e);
    return [];
  }
}

async function round(brief: PeopleBrief, angle: Angle): Promise<Person[]> {
  const look = LOOK[angle];
  const search = await ask(
    Search,
    `${describe(brief)}

We want to find ${look.find}.
- phrases: 5 to 8 phrases the way these people would actually type them in a post, not marketing words. E.g. for software "any tool that...", "how do I...", "alternative to <competitor>"; for things people buy "where can I buy...", "is <brand> worth it", "gift for a ... fan", "looking for a ..."; for either "recommend a ...". Use the kind that fits this product.
- keywords: 4 to 6 short search terms (1 to 3 words) for a keyword search engine, e.g. "calendly alternative", "scheduling tool". Include "<competitor> alternative" for the main competitors.
- terms: 6 to 10 single lowercase words specific to this niche that a relevant post would contain (product category words and competitor names, e.g. "calendly", "scheduling", "booking"). No generic words like "tool", "app", "best", "help".
- subreddits: 6 to 10 real, active subreddit names (no "r/") where this audience asks for help, recommendations or where to buy, or talks about this topic. Prefer niche subreddits about this exact problem or category over general business ones.
- linkedin: 3 Google queries that find LinkedIn posts like these, e.g. site:linkedin.com/posts "looking for" <niche>, site:linkedin.com/posts "any recommendations" <problem>.`,
  );
  console.log(`[people] ${angle} search`, search);

  const asks = angle !== "talking";
  const sources = {
    google_reddit: redditFromGoogle(search.phrases, look.days),
    reddit: reddit(search.subreddits, search.terms, look.days, asks),
    hn: hackerNews(search.keywords, look.days),
    linkedin: linkedin(search.linkedin),
    x: x(search.phrases, search.terms, look.days, asks),
  };
  const settled = await Promise.allSettled(Object.values(sources));
  const found: Candidate[] = [];
  settled.forEach((r, i) => {
    const name = Object.keys(sources)[i];
    if (r.status === "fulfilled") {
      console.log(`[people] ${angle} ${name}: ${r.value.length} candidates`);
      found.push(...clean(r.value, brief, search.terms).slice(0, CAP[name]));
    } else console.warn(`[people] ${angle} ${name} failed:`, r.reason);
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

Below are recent posts. For each one, score 0 to 10: ${look.score}

For every post scoring 6 or more, also write:
- why: ${look.why}
${look.reply}

Return JSON: {"results": [{"i": number, "score": number, "why": string, "reply": string}]} with one entry per post.

${list}`,
      )).results;
    }),
  );
  scored.forEach((r) => r.status === "rejected" && console.warn(`[people] ${angle} scoring batch failed:`, r.reason?.message ?? r.reason));
  const results = scored.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  console.log(`[people] ${angle} scores`, results.map((r) => r.score).join(" "));
  if (process.env.PEOPLE_DEBUG)
    for (const r of [...results].sort((a, b) => b.score - a.score).slice(0, 8))
      console.log(`[people] debug ${r.score} ${candidates[r.i]?.url}\n  ${candidates[r.i]?.text.slice(0, 220).replace(/\n/g, " ")}`);
  const best = results
    .filter((r) => r.score >= 6 && candidates[r.i])
    .sort((a, b) => b.score - a.score)
    .filter((r, k, all) => all.findIndex((o) => o.i === r.i) === k)
    .slice(0, 10);

  // No links in replies: Reddit and most communities remove them (and X shows link replies
  // to fewer people). The reply names the product; people who want it search it or ask.
  return best.map((r) => {
    const c = candidates[r.i];
    const reply = r.reply.replaceAll("{link}", "").replace(/\s{2,}/g, " ").trim();
    const tweetId = c.platform === "x" ? c.url.split("/status/")[1] : undefined;
    const replyUrl = tweetId ? `https://x.com/intent/post?in_reply_to=${tweetId}&text=${encodeURIComponent(reply)}` : undefined;
    return { ...c, score: r.score, why: r.why, reply, replyUrl, kind: angle === "talking" ? ("talking" as const) : ("asking" as const) };
  });
}

// Same post twice, the product's or a competitor's own posts, and long walls of text.
// Most on-topic first (how many niche terms it mentions), then newest.
function clean(found: Candidate[], brief: PeopleBrief, terms: string[]): Candidate[] {
  // The brand from the address: store.ferrari.com -> ferrari, app.cal.com -> cal (skip the TLD and shop-type subdomains).
  const labels = new URL(brief.url).hostname.split(".").slice(0, -1);
  const host = labels.filter((l) => !/^(www|store|shop|app|web|get|try|go|my|en|m)$/.test(l)).at(-1) ?? labels.at(-1) ?? "";
  const brands = [host, ...(brief.name ? [brief.name] : []), ...brief.competitors].map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((n) => n.length > 2);
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
