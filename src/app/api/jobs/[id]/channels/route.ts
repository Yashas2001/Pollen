import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getJob, type Job } from "@/lib/jobs";
import { DATA_ROOT } from "@/lib/links";

// Prepared work for channels we can't launch yet (ads, email, creators, auto-posting).
// Made once per job with one Gemini call, then served from data/channels/<id>.json.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 90_000 } });
const MODEL = "gemini-3.8-flash";
const DIR = path.join(DATA_ROOT, "channels");

const Channels = z.object({
  meta: z.object({
    headline: z.string(),
    primaryText: z.string(),
    targeting: z.object({ age: z.string(), interests: z.array(z.string()), places: z.array(z.string()) }),
    dailyBudgetUsd: z.number(),
    budgetWhy: z.string(),
  }),
  google: z.object({
    headlines: z.array(z.string()),
    descriptions: z.array(z.string()),
    keywords: z.array(z.string()),
  }),
  email: z.object({ subject: z.string(), body: z.string() }),
  creators: z.object({ niche: z.string(), size: z.string(), dm: z.string() }),
  autopost: z.object({
    plan: z.array(z.object({ video: z.string(), platform: z.string(), day: z.string(), time: z.string() })),
  }),
});
export type Channels = z.infer<typeof Channels>;

function parseJson<T>(schema: z.ZodType<T>, text: string | undefined): T {
  const raw = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return schema.parse(JSON.parse(raw.slice(start, end + 1)));
}

// Google rejects longer ones, so cut at a word if the model ran over.
function fit(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s,;:-]+$/, "");
}

async function prepare(job: Job): Promise<Channels> {
  const brief = job.plan?.brief;
  const videos = job.videos.map((v, i) => `Video ${i + 1}: "${v.props.script.title}" (${v.props.script.format})`).join("\n");
  const first = job.videos[0]?.props.script;
  const prompt = `You prepare launch-ready marketing for one specific product. Everything must be about THIS product and its buyers. No generic advice, no placeholders like [Name] except where a person's name goes.

Product site: ${job.url}
What it is: ${brief?.what ?? ""}
Who buys it: ${brief?.who ?? ""}
Their pain: ${brief?.pain ?? ""}
Proof from the site: ${brief?.proof ?? ""}
Our first video's hook: ${first?.shots[0]?.voiceLine ?? ""} / on screen: ${first?.shots[0]?.onScreenText ?? ""}
Our first video's caption: ${first?.postCaption ?? ""}
This week's 3 videos:
${videos}

Only claim what the brief supports. No invented numbers, customers or awards.

Return JSON only, matching:
{"meta": {"headline": string, "primaryText": string, "targeting": {"age": string, "interests": string[], "places": string[]}, "dailyBudgetUsd": number, "budgetWhy": string},
 "google": {"headlines": string[], "descriptions": string[], "keywords": string[]},
 "email": {"subject": string, "body": string},
 "creators": {"niche": string, "size": string, "dm": string},
 "autopost": {"plan": [{"video": string, "platform": string, "day": string, "time": string}]}}

- meta: Meta (Facebook/Instagram) ad. primaryText is exactly 2 lines separated by "\\n". targeting: age range like "25-44", 3 to 6 interests, 1 to 4 countries or cities. dailyBudgetUsd: a sensible starting test budget; budgetWhy: one line.
- google: Google search ad. Exactly 3 headlines, each 30 characters or fewer (count them). Exactly 2 descriptions, each 90 characters or fewer. Exactly 5 keywords people would type.
- email: a cold email to one likely customer. Subject under 8 words. Body 90 words or fewer, plain text, starts with "Hi [Name],".
- creators: what kind of creators fit (niche) and their size (follower range), plus a short DM (under 60 words) to send them.
- autopost: one entry per video (use the video names above) saying which platform (TikTok, Instagram Reels or YouTube Shorts), which weekday and what local time to post.`;

  console.log(`[channels] gemini call for job ${job.id}`);
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Channels) },
  });
  const out = parseJson(Channels, res.text);
  out.google.headlines = out.google.headlines.slice(0, 3).map((h) => fit(h, 30));
  out.google.descriptions = out.google.descriptions.slice(0, 2).map((d) => fit(d, 90));
  out.google.keywords = out.google.keywords.slice(0, 5);
  return out;
}

// Two people opening the page at once share one Gemini call.
const inFlight = new Map<string, Promise<Channels>>();

async function load(job: Job): Promise<Channels> {
  const file = path.join(DIR, `${job.id}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as Channels;
  } catch {
    // Not made yet.
  }
  const out = await prepare(job);
  await mkdir(DIR, { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(out, null, 2));
  await rename(`${file}.tmp`, file);
  return out;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  if (job.step !== "ready") return Response.json({ error: "Not ready" }, { status: 409 });

  let pending = inFlight.get(id);
  if (!pending) {
    pending = load(job).finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  try {
    return Response.json(await pending, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[channels] failed", err);
    return Response.json({ error: "Could not prepare" }, { status: 500 });
  }
}
