import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { zodTextFormat } from "openai/helpers/zod";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { Brand, Script } from "@/remotion/schema";
import type { Asset, SiteElement } from "@/remotion/schema";
import type { SiteRead } from "./site";
import type { Outlier } from "./research/types";

// The writer turns a website into a brief, brand colours and three video scripts.
// Two interchangeable backends, picked by WRITER in .env.local:
//   azure     -> Luna (gpt-5.6-luna) on our Azure AI Foundry resource
//   anthropic -> Claude Opus 5.5
// Same prompt, same output shape, so switching is one env line.

export const Plan = z.object({
  brief: z.object({
    what: z.string(),
    who: z.string(),
    pain: z.string(),
    proof: z.string(),
  }),
  brand: Brand,
  videos: z.array(Script),
});
export type Plan = z.infer<typeof Plan>;

const SYSTEM = `You are the social media lead for a small brand. You make short vertical videos (TikTok, Reels, Shorts) that sell the product without feeling like ads. You get the brand's website and their product images, and you write three different videos for this week's posts.

How these videos work:
- The first second decides everything. The hook is a sharp, specific line a scroller from the target audience would stop for: a pain they feel, a surprising claim, or a "POV" moment. Never open with the brand name or "Introducing".
- Speak like a person, not a landing page. Short sentences. Concrete details from the site beat adjectives.
- Total voiceover 12 to 22 seconds. 4 to 7 shots. Each shot has one short voice line and 2 to 7 words of on-screen text that adds to the voice instead of repeating it word for word.
- Every video has real moving footage. If they gave no talking clip and no footage of their own, use stock shots for the hook, the problem and any beat a person carries in the recipe, and show the product itself with their site, photos and scenes. With their own material, stock only fills a gap. At most half the shots are stock.
- Their own material beats the website. Their photos (labelled "their photo") come before site images and screenshots.
- Real footage beats everything. When the assets include videos (site videos, their screen recordings) or a talking clip, build the videos around them: talk and footage shots carry most of each video, and motion-design scenes only fill in what the footage can't show. Without footage, every shot is a motion-design scene: pick the one that shows the point best and vary them (never two "panel" shots in a row).
- Write hooks the way creators talk, shaped like the recipe's hook, never a slogan ("I stopped editing my own videos" beats "Goodbye, manual editing").
- Only claim what the site supports. No invented numbers, customers or awards.
- The last voice line leads into the call to action; the cta line is the end card (short, with the domain).

Scenes (set scene and only the fields that scene uses; unused: assetIndex -1, secondAssetIndex -1, elementIndex -1, prompt "", items [], clipStart -1, phrase -1, stockQuery ""):
- talk: replays the moment of their video where this shot's phrase is said, picture and sound together, full screen (assetIndex = the clip that phrase comes from). The picture is whatever that clip shows at that moment: the person, or the product if their video cuts to a demo there (check the clip's description). Only in "clip" voice videos. In "ai" videos a talking clip can still be used as silent footage.
- footage: a video asset full screen (assetIndex = that video); clipStart = the second to start from, picked from the video's description so the moment shown matches the line.
- stock: real stock footage found by stockQuery (2 to 5 concrete search words, e.g. "tired man laptop night", "woman filming phone selfie"), full screen. People, places and moods that set up the story, never the product itself and never someone talking to camera (the lips would not match the voice). clipStart 0.
  For talk, footage and stock, onScreenText is 1 to 3 punch words (like "CAPTIONS" or "ONE CLICK") that slam in big over the footage.
- type: big kinetic text only. Best for hooks and turning points.
- panel: an asset (assetIndex) floating in 3D; full-page screenshots scroll.
- prompt: a prompt box types "prompt" (a short request a user would type into this product, 3 to 7 words, e.g. "Make it in 4 colors"), it is sent, and the result appears (assetIndex, ideally a product image). Use it when the product does something on request: AI, search, generation, customisation.
- fan: one image bursts into variations, each labelled from items (3 to 5 short labels like "TikTok", "Black Friday", "Story"). assetIndex = the image. For "one X becomes many Y".
- focus: the camera dives into one real part of the site (elementIndex from the element list) and a cursor clicks it. Best for "here's how it works" beats about a specific button, feature or section.
- checklist: items (3 to 5, 1 to 3 words each) slam in with ticks. For "everything it does" beats.
- before_after: a wipe from assetIndex (before, washed out) to secondAssetIndex (after); items = [before label, after label].
- logo: logo + line. At most once.

voice:
- "clip": the video is carried by their own words. Only when there is a talking clip. Each shot sets phrase = one phrase number from the transcript, in the order that makes the best video (strongest hook first), each phrase at most once, and voiceLine = that phrase's text copied exactly. 4 to 8 phrases, 12 to 30 seconds in total. The first shot is always talk (their hook, in their words), and at least half the shots are talk; the others cut away to footage or a scene that shows what they say in that phrase. Which videos use "clip": the ones whose recipe is carried by a person on camera; a recipe built on product shots, photos or screens keeps that look with an "ai" voice and their footage and photos. If there are talking clips but no recipe needs a person, still make one "clip" video. Phrases in one video come from one clip. With several talking clips, give each "clip" video a different clip; never open two videos on the same phrase.
- "ai": a voiceover you write (phrase -1 on every shot). No talk shots.

theme: "light" (airy, white cards, blurred product backdrop) or "dark" (cinematic). Follow the recipe's look; without a recipe, light suits physical products and bright brands, dark suits software and tech.

Write three videos.

When you are given winning recipes (structures pulled from Shorts that beat their channel's usual views in this niche), each video follows a different recipe: its hook type and hook pattern, the order and job of its beats, the scene each beat uses, its pacing, its look and its ending, adapted to this product. Copy the structure and the motion design, never their words, footage or claims. Beats marked "person" (someone on camera) use talk when there is a talking clip; otherwise stock (a person in the situation, not talking to camera) or their footage. Set basedOn to that recipe's number. If there are fewer than three recipes, the remaining videos use the formats below with basedOn -1.

Formats (also the visual style: set format to the closest one for every video):
- hook_demo: a hook line, then show what the product does in 2 to 4 quick beats, then the payoff.
- problem_fix: open on the pain (mood "problem" for those shots), turn ("so we built..."), show the fix (mood "solution").
- three_reasons: a hook like "3 reasons [audience] switch to X", then exactly 3 reason shots (shots 2, 3, 4), then a closer.

Brand colours: pick primary (the brand's accent, used for highlights and the end card), background and text as hex values that look like the site and read well together. Use the colour hints when they make sense.

brief.what is what the product itself is, in one plain sentence (e.g. "Official Scuderia Ferrari team replica jackets, caps and shirts"), never a description of the videos.
postCaption is what they paste when posting: one or two lines in the same voice, ending with a short pointer to the link in bio (captions are not clickable), no hashtags inside it, no em dashes (they read as AI-written). hashtags: 3 to 5, no # sign.`;

function recipesText(outliers: Outlier[]): string {
  const withRecipe = outliers.map((o, i) => ({ o, i })).filter(({ o }) => o.recipe);
  if (!withRecipe.length) return "No winning recipes found for this niche. Use the formats.";
  return withRecipe
    .map(({ o, i }) => {
      const r = o.recipe!;
      return `Recipe ${i}: from "${o.title}" by ${o.channel} (${o.views.toLocaleString("en-US")} views, ${o.multiple}x that channel's usual)
- hook: ${r.hookType}. Pattern: ${r.hookPattern}
- first seconds: ${r.firstSeconds}
- look: ${r.look}${r.needsPerson ? " (a person on camera carries it)" : ""}
- beats:
${r.beats.map((b) => `  ${b.seconds}s [${b.scene}] ${b.what}. On screen: ${b.onScreen}`).join("\n")}
- pacing: ~${r.avgShotSeconds}s per shot, ${r.lengthSeconds}s total. Text on screen: ${r.textOnScreen}. Voice: ${r.voice}
- ending: ${r.ending}
- why it works: ${r.whyItWorks}`;
    })
    .join("\n\n");
}

export type TalkInfo = {
  clips: { assetIndex: number; label: string }[];
  phrases: { clip: number; text: string; start: number; end: number }[];
} | null;

function assetLine(a: Asset, i: number): string {
  if (a.kind === "image") return `${i}: ${a.label} (photo, ${a.width}x${a.height})`;
  if (a.kind === "video" || a.kind === "talk") return `${i}: ${a.kind === "talk" ? "TALKING CLIP" : "VIDEO"} ${Math.round(a.durationSec ?? 0)}s, ${a.width > a.height ? "wide" : "vertical"}. ${a.label}`;
  return `${i}: ${a.label}`;
}

function talkText(talk: TalkInfo): string {
  if (!talk || !talk.phrases.length) return "No talking clips. Every video uses voice \"ai\".";
  return `Talking clips: ${talk.clips.map((c, i) => `clip ${i} = asset ${c.assetIndex}`).join(", ")}.
Every phrase they say, numbered across all clips (phrase: clip, seconds, words):
${talk.phrases.map((p, i) => `${i}: clip ${p.clip}, ${p.start.toFixed(1)}-${p.end.toFixed(1)}s "${p.text}"`).join("\n")}`;
}

function userText(site: SiteRead, assets: Asset[], elements: SiteElement[], outliers: Outlier[], talk: TalkInfo): string {
  const assetList = assets.map(assetLine).join("\n");
  const elementList = elements.length ? elements.map((e, i) => `${i}: ${e.kind} "${e.label}"`).join("\n") : "none found";
  return `Winning recipes in this niche:
${recipesText(outliers)}

Website: ${site.url}
Title: ${site.title}
Description: ${site.description}
Colour hints: theme ${site.themeColor ?? "none"}, main button ${site.buttonColor ?? "none"}, page background ${site.backgroundColor ?? "none"}

Assets you can show (index: what it is):
${assetList}

${talkText(talk)}

Parts of the site a focus scene can dive into (elementIndex: kind "text"):
${elementList}

The image above is the first screen of the site on a phone.

Site text:
${site.text}`;
}

export async function planVideos(
  site: SiteRead,
  heroPath: string,
  assets: Asset[],
  elements: SiteElement[],
  outliers: Outlier[],
  talk: TalkInfo = null,
): Promise<Plan> {
  const hero = (await readFile(heroPath)).toString("base64");
  const text = userText(site, assets, elements, outliers, talk);
  if (process.env.WRITER === "anthropic") return planWithClaude(hero, text);
  // Luna first; if it's down or the network eats it, Gemini writes instead.
  try {
    return await planWithLuna(hero, text);
  } catch (e) {
    console.warn("[writer] Luna failed, using Gemini:", (e as Error).message);
    return planWithGemini(hero, text);
  }
}

async function planWithGemini(hero: string, text: string): Promise<Plan> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 120_000 } });
  const res = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: hero } }, { text }] }],
    config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Plan) },
  });
  return Plan.parse(JSON.parse(res.text ?? ""));
}

async function planWithLuna(hero: string, text: string): Promise<Plan> {
  const client = new OpenAI({
    baseURL: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    timeout: 150_000,
    maxRetries: 1,
  });
  const response = await client.responses.parse({
    model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5.6-luna",
    instructions: SYSTEM,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: `data:image/jpeg;base64,${hero}`, detail: "auto" },
          { type: "input_text", text },
        ],
      },
    ],
    reasoning: { effort: "medium" },
    text: { format: zodTextFormat(Plan, "plan") },
  });
  if (!response.output_parsed) throw new Error(`Luna returned no plan (status: ${response.status}).`);
  return response.output_parsed;
}

async function planWithClaude(hero: string, text: string): Promise<Plan> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: hero } },
          { type: "text", text },
        ],
      },
    ],
    output_config: { format: betaZodOutputFormat(Plan) },
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this site.");
  if (!response.parsed_output) throw new Error(`Claude returned no plan (stop: ${response.stop_reason}).`);
  return response.parsed_output;
}
