import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Job } from "@/lib/jobs";
import { CLASSIC } from "@/lib/research";
import { getVideos, searchShorts } from "@/lib/research/youtube";
import { getChannels, searchVideos } from "./youtube";
import { bioSites, findEmails, siteContacts } from "./contacts";
import type { Creator, Outreach, Partner } from "./types";

// Who to reach out to: creators whose audience already watches this problem (YouTube,
// checked data), and businesses that serve the same buyers (agencies, studios,
// newsletters...), found with Google Search and kept only if their site loads.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 90_000 } });
const MODEL = "gemini-3.8-flash";
const MAX_CREATORS = 8;
const MAX_PARTNERS = 8;
const MIN_SUBS = 2_000;
const MAX_SUBS = 2_000_000; // past this they don't answer DMs from small products

function parseJson<T>(schema: z.ZodType<T>, text: string | undefined): T {
  const raw = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return schema.parse(JSON.parse(raw.slice(start, end + 1)));
}

const describe = (job: Job) => {
  const b = job.plan?.brief;
  const n = job.research?.niche;
  return `Product: ${job.plan?.brand.name || job.url} (${job.url})
What it is: ${b?.what ?? ""}
Who buys it: ${b?.who ?? n?.audience ?? ""}
Their pain: ${b?.pain ?? ""}
Proof from the site: ${b?.proof ?? ""}
Niche: ${n?.niche ?? "unknown"}
Competitors: ${n?.competitors.map((c) => c.name).join(", ") || "none known"}
Founder's first name: ${job.owner?.name?.split(" ")[0] || "unknown"}`;
};

// The shape of cold messages that get replies (from the founders' own emails that did).
const VOICE = `How to write it. Cold messages that get replies follow this shape, in this order:
1. How you came across them, true to how we found them (e.g. while looking at people who do their kind of work), said so it's clear you took them seriously.
2. One or two specific details of their actual work, taken from what they say about themselves below: what they make, a number, a format, the kind of clients. This is the proof it isn't a mass message. Never invent a detail; if the info is thin, use what's there.
3. One plain line on what the product is, described in the words of their work, not the site's marketing words.
4. Honest doubt: you don't know if it fits how they already work, they may have their own tools for this.
5. A small ask: free access to try it on something real. No call, no meeting, no price, no discount, no deal or partnership terms.
6. Make them the expert: you mostly want to see if it's actually useful for someone doing what they do. Saying it's not a pitch is fine.
Tone: one founder writing to one person. Casual and plain, contractions, short paragraphs of one or two lines. No hype words, no "I hope this finds you well", no "hop on a call", no praise beyond the one true observation. Only claim what the product facts above support.
No link and no URL anywhere: the only thing to do is reply.
End with the founder's first name on one line and "Founder, <product name>" on the next (just "Founder, <product name>" if the name is unknown), with no "Best," or "Cheers," before it. No em dashes.`;

// Belt and braces for "no link": a stray placeholder or a line that is only a URL comes out.
const noLinks = (text: string) =>
  text
    .replace(/\{link\}/g, "")
    .split("\n")
    .filter((l) => !/^\s*https?:\/\/\S+\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ---------- Creators ----------

// No email in their YouTube bio: try the first two sites it links to (their own site or
// a link-in-bio page). Only emails they published, never guessed.
async function bioEmail(description: string): Promise<string | null> {
  for (const site of bioSites(description).slice(0, 2)) {
    const found = await siteContacts(site).catch(() => null);
    if (found?.emails[0]) return found.emails[0];
  }
  return null;
}

const Picked = z.object({
  picks: z.array(z.object({ i: z.number(), video: z.string(), why: z.string(), subject: z.string(), dm: z.string() })),
});

export async function findCreators(job: Job, notes: string[]): Promise<Creator[]> {
  const niche = job.research?.niche;
  if (!niche) return [];

  // Research already looked at the niche's channels: start from those, no new search.
  // Older jobs without them, or RESEARCH_MODE=classic, search like before (100 quota units a search).
  let videos: { id: string; title: string; channelId: string; views: number }[] = (!CLASSIC && job.research?.pool) || [];
  if (!videos.length) {
    const ids = new Set<string>();
    const searches = [
      ...niche.queries.slice(0, 2).map((q) => () => searchShorts(q)), // same as research: cached, often free
      () => searchVideos(niche.queries[0] ?? niche.niche),
    ];
    for (const s of searches) {
      try {
        (await s()).forEach((id) => ids.add(id));
      } catch (e) {
        notes.push(`creator search: ${(e as Error).message}`);
      }
    }
    if (!ids.size) return [];
    videos = await getVideos([...ids]);
  }

  // Their most-watched video in this niche, one per channel.
  const best = new Map<string, (typeof videos)[number]>();
  for (const v of videos.sort((a, b) => b.views - a.views)) if (!best.has(v.channelId)) best.set(v.channelId, v);

  const competitorIds = new Set((job.research?.outliers ?? []).filter((o) => o.source.startsWith("competitor")).map((o) => o.channelId));
  const competitorNames = niche.competitors.map((c) => c.name.toLowerCase()).filter((n) => n.length > 2);
  const channels = (await getChannels([...best.keys()])).filter(
    (c) =>
      !competitorIds.has(c.id) &&
      !competitorNames.some((n) => c.title.toLowerCase().includes(n)) &&
      (c.subscribers === null || (c.subscribers >= MIN_SUBS && c.subscribers <= MAX_SUBS)),
  );
  if (!channels.length) return [];

  // Every video of theirs we found, so the message can name their real work.
  const theirVideos = (id: string) => videos.filter((v) => v.channelId === id).slice(0, 3);
  const theirs = (id: string) =>
    theirVideos(id)
      .map((v, n) => `(${String.fromCharCode(97 + n)}) "${v.title}" (${v.views} views)`)
      .join(", ");
  // Who the founder can actually email: in their bio, else on a site the bio links to.
  const shortlist = channels.slice(0, 30);
  const emails = await Promise.all(shortlist.map(async (c) => findEmails(c.description)[0] ?? (await bioEmail(c.description))));
  const list = shortlist
    .map(
      (c, i) =>
        `[${i}] ${c.title} | ${c.subscribers ?? "hidden"} subscribers | email: ${emails[i] ? "listed" : "none"} | videos: ${theirs(c.id)}\nAbout: ${c.description.replace(/\s+/g, " ").slice(0, 600)}`,
    )
    .join("\n\n");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: `${describe(job)}

These YouTube channels made popular videos about this product's niche. Pick up to ${MAX_CREATORS} the founder should reach out to: independent creators whose viewers are this product's buyers, who could plausibly try it and show it to their audience. Skip brand or company channels, competitors, news, clip or reupload channels, and channels whose video only matched a search word by accident. When two channels fit about as well, pick the one with an email listed: those are the ones the founder can actually reach.

${list}

For each pick:
- i: its number.
- video: the letter of their video that best shows the fit, like "a".
- why: one sentence on why they fit, naming that video and its views.
- subject: an email subject under 7 words, plain like a note from a person and about them, not a pitch line.
- dm: an email to them, 70 to 120 words. Start with "Hey <their first name if the About shows it, else the channel name>,". You found them through their videos, so the details come from their videos and About.

${VOICE}

Return JSON only: {"picks": [{"i": number, "video": string, "why": string, "subject": string, "dm": string}]}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(Picked),
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  const { picks } = parseJson(Picked, res.text);

  const out: Creator[] = [];
  for (const p of picks.slice(0, MAX_CREATORS)) {
    const c = shortlist[p.i];
    if (!c || out.some((o) => o.name === c.title)) continue;
    const v = theirVideos(c.id)[p.video.trim().toLowerCase().charCodeAt(0) - 97] ?? best.get(c.id)!;
    out.push({
      name: c.title,
      url: c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`,
      thumbnail: c.thumbnail,
      subscribers: c.subscribers,
      video: { title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, views: v.views },
      email: emails[p.i] ?? null,
      why: p.why,
      subject: p.subject,
      dm: noLinks(p.dm),
    });
  }
  return out;
}

// ---------- Businesses (agencies, studios, newsletters...) ----------

const Found = z.object({
  partners: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
      kind: z.string(),
      why: z.string(),
      contactRole: z.string(),
    }),
  ),
});

const Written = z.object({
  emails: z.array(z.object({ i: z.number(), subject: z.string(), body: z.string() })),
});

async function findPartners(job: Job, notes: string[]): Promise<Partner[]> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: `${describe(job)}

Use Google Search. Find 12 real, currently active businesses the founder could partner with to reach this product's buyers. Good fits: agencies or studios that do this work for clients (they could use the product for client work), consultancies, paid communities, newsletters or podcasts read by these buyers, and complementary tools with the same customers (not competitors). Prefer small and mid-size ones that answer email over famous giants. Only include businesses you saw in search results, with their real website. Never invent one.

Return JSON only:
{"partners": [{"name": string, "website": string, "kind": string, "why": string, "contactRole": string}]}

- website: their homepage URL.
- kind: one or two words, e.g. "video agency", "newsletter", "community", "complementary tool".
- why: one sentence on why they fit, specific to what they do.
- contactRole: who to ask for, e.g. "founder", "partnerships lead".`,
    config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  const found = parseJson(Found, res.text).partners;

  const own = new URL(job.url.startsWith("http") ? job.url : `https://${job.url}`).hostname.replace(/^www\./, "");
  const checked = await Promise.all(
    found.map(async (p) => {
      const website = p.website.startsWith("http") ? p.website : `https://${p.website}`;
      if (website.includes(own)) return null;
      const site = await siteContacts(website);
      if (!site) notes.push(`partner site didn't load: ${website}`);
      return site ? { p, site } : null;
    }),
  );
  const kept = checked.filter((h) => h !== null).slice(0, MAX_PARTNERS);
  if (!kept.length) return [];

  // Written after their site is read, so each email can name real details of their work.
  const list = kept
    .map(({ p, site }, i) => `[${i}] ${p.name} (${p.kind}, ${site.website}). Ask for: ${p.contactRole}\nTheir site says: ${site.text}`)
    .join("\n\n");
  const wrote = await ai.models.generateContent({
    model: MODEL,
    contents: `${describe(job)}

Write a cold email from the founder to each of these businesses. We found them while looking for ${job.research?.niche?.niche ?? "businesses that serve this product's buyers"}.

${list}

For each one:
- i: its number.
- subject: under 7 words, plain like a note from a person and about them, not a pitch line.
- body: 90 to 140 words. Start with "Hey <a person's first name if their site names the founder or team lead, else the business name>,". The ask fits what they are: for an agency or studio, their team tries it on real client work; for a newsletter, community or podcast, they try it themselves first and see if it's worth telling their readers about; for a tool, they try it and see if your users and theirs overlap.

${VOICE}

Return JSON only: {"emails": [{"i": number, "subject": string, "body": string}]}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(Written),
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  const emails = new Map(parseJson(Written, wrote.text).emails.map((e) => [e.i, e]));

  const out: Partner[] = [];
  kept.forEach(({ p, site }, i) => {
    const e = emails.get(i);
    if (!e) return;
    out.push({
      name: p.name,
      website: site.website,
      kind: p.kind,
      why: p.why,
      contactRole: p.contactRole,
      email: site.emails[0] ?? null,
      contactPage: site.contactPage,
      linkedin: site.linkedin,
      subject: e.subject,
      body: noLinks(e.body),
    });
  });
  // Ones you can email right now first.
  return out.sort((a, b) => Number(!!b.email) - Number(!!a.email));
}

export async function findOutreach(job: Job): Promise<Outreach> {
  const notes: string[] = [];
  const [creators, partners] = await Promise.all([
    // One retry: a single bad model reply shouldn't cost the whole list.
    findCreators(job, notes)
      .catch(() => findCreators(job, notes))
      .catch((e) => (notes.push(`creators: ${(e as Error).message}`), [] as Creator[])),
    findPartners(job, notes).catch((e) => (notes.push(`partners: ${(e as Error).message}`), [] as Partner[])),
  ]);
  if (notes.length) console.log(`[outreach] ${job.id} notes`, notes);
  return { creators, partners, notes };
}
