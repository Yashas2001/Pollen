import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { Niche, Recipe } from "./types";
import type { Outlier } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 90_000 } });
const MODEL = "gemini-3.8-flash";

function parseJson<T>(schema: z.ZodType<T>, text: string | undefined): T {
  const raw = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return schema.parse(JSON.parse(raw.slice(start, end + 1)));
}

// Reads what the product is and searches the web for who it competes with,
// including their real YouTube handles (never guessed: a wrong handle points at
// someone else's channel).
export async function findNiche(site: { url: string; title: string; description: string; text: string }): Promise<Niche> {
  const prompt = `You research short-form video marketing for this product.

Website: ${site.url}
Title: ${site.title}
Description: ${site.description}
Site text (start):
${site.text.slice(0, 4000)}

Use Google Search. Return JSON only, matching:
{"niche": string, "audience": string, "queries": string[], "competitors": [{"name": string, "youtubeHandle": string}]}

- niche: the product category in a few words.
- audience: who buys it.
- queries: 3 short YouTube search phrases for Shorts this audience watches about this problem or category (how people search, not brand names).
- competitors: up to 5 direct competitors or close alternatives that post short videos. youtubeHandle is their official channel handle like "@capcut", only if you confirmed it in search results, otherwise "".`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  return parseJson(Niche, res.text);
}

// Independent YouTube creators this product's buyers already watch, found with
// Google Search. Replaces YouTube's own search (100 quota units a call): each
// handle then costs ~3 units to check, and a handle that doesn't exist is dropped.
export async function findNicheChannels(niche: Niche): Promise<string[]> {
  const prompt = `Niche: ${niche.niche}. Audience: ${niche.audience}.
Competitors (leave these out): ${niche.competitors.map((c) => c.name).join(", ") || "none"}.

Use Google Search. Find 12 YouTube channels whose videos are about this kind of product itself: reviews, comparisons, how-tos, showing how they use it. Not channels about the wider hobby or topic around it (for running shoes: shoe reviewers, not race coverage). Independent creators who post regularly: some who make Shorts, some who make longer reviews or tutorials. Mostly small and mid-size, a few thousand to a few hundred thousand subscribers. No brand or company channels, no competitors, no news channels.
Only include a channel whose exact handle (like "@name") you saw in search results. Never guess a handle.

Return JSON only: {"handles": ["@name", ...]}`;
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  return parseJson(z.object({ handles: z.array(z.string()) }), res.text).handles.map((h) => h.trim()).filter((h) => /^@?[\w.-]+$/.test(h));
}

// Watches one winning Short and writes down its structure.
export async function watchRecipe(videoUrl: string, title: string): Promise<Recipe> {
  const prompt = `This short video ("${title}") performed far above its channel's usual views. Watch it and write down its recipe: the structure someone could reuse for a different product. Describe structure, not the specific content.

Return JSON only, matching:
{"hookType": string, "hookPattern": string, "firstSeconds": string, "beats": [{"seconds": number, "what": string, "onScreen": string, "scene": string}], "avgShotSeconds": number, "textOnScreen": string, "voice": string, "ending": string, "whyItWorks": string, "lengthSeconds": number, "look": "dark" | "light", "needsPerson": boolean}

- hookType: e.g. "pain question", "POV", "bold claim", "before/after", "list".
- hookPattern: the opening line as a reusable template with [brackets].
- beats: each beat in order. "what" = its job in the story. "onScreen" = literally what is on screen and how it moves (layout, UI elements, typing, cursor, transitions, text style). "scene" = the closest of these motion-design scenes:
  type (big kinetic text only, no product on screen),
  panel (the product itself on screen: a product photo or close-up, the product in hand, or a website/app screenshot),
  prompt (a prompt or search box types a request, it is sent, the result appears),
  fan (one image bursts into many variations or versions),
  focus (only for software: zooming into one part of an app or website screen, a cursor clicks it),
  checklist (features or items pop in one by one, often with ticks or icons),
  before_after (split screen or wipe from before to after),
  logo (logo or brand card),
  person (a human talking to camera carries the beat).
- look: "light" if the video is bright and airy, "dark" if dark and cinematic.
- needsPerson: true if a person on camera is central to the format.
- whyItWorks: one sentence.`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }] }],
    config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Recipe) },
  });
  return parseJson(Recipe, res.text);
}

// Keeps only Shorts that are about the same problem or category, or that market
// a similar product. Search phrases like "edit" also match fan edits and memes.
export async function keepRelevant(niche: Niche, candidates: Outlier[]): Promise<Set<string>> {
  if (!candidates.length) return new Set();
  const list = candidates.map((c) => `${c.videoId} | ${c.channel} | ${c.title}`).join("\n");
  const prompt = `Niche: ${niche.niche}. Audience: ${niche.audience}.

Which of these YouTube Shorts would this audience see as being about this niche: the same problem, the same kind of product, or a brand marketing a similar product? Exclude fan edits, memes, music edits, gaming, and anything off-topic.

${list}

Return JSON only: {"keep": ["videoId", ...]}`;
  const res = await ai.models.generateContent({ model: MODEL, contents: prompt, config: { responseMimeType: "application/json" } });
  return new Set(parseJson(z.object({ keep: z.array(z.string()) }), res.text).keep);
}
