import { z } from "zod";

// What research hands to the writer and the results page.

export const Niche = z.object({
  niche: z.string(), // e.g. "AI video editing tools for creators"
  audience: z.string(),
  // Short YouTube search phrases a buyer in this niche would watch Shorts about.
  queries: z.array(z.string()),
  competitors: z.array(
    z.object({
      name: z.string(),
      youtubeHandle: z.string(), // "@handle", or "" if not found
    }),
  ),
});
export type Niche = z.infer<typeof Niche>;

// Structure only: what to copy from a winning video. Never its footage or words.
export const Recipe = z.object({
  hookType: z.string(), // e.g. "pain question", "POV", "bold claim", "before/after"
  hookPattern: z.string(), // the hook as a fill-in template, e.g. "Stop [doing X] like this"
  firstSeconds: z.string(), // what happens on screen in the first 2 seconds
  beats: z.array(
    z.object({
      seconds: z.number(),
      what: z.string(), // what this beat says / does for the story
      onScreen: z.string(), // literally what is on screen and how it moves
      scene: z.string(), // closest of our scenes, or "person" if a human on camera carries it
    }),
  ),
  look: z.enum(["dark", "light"]), // overall feel: dark cinematic vs bright airy
  needsPerson: z.boolean(), // a real human on camera is central to it
  avgShotSeconds: z.number(),
  textOnScreen: z.string(), // how on-screen text is used
  voice: z.string(), // "voiceover", "talking to camera", "text only + music", ...
  ending: z.string(), // how it ends / the call to action
  whyItWorks: z.string(), // one sentence
  lengthSeconds: z.number(),
});
export type Recipe = z.infer<typeof Recipe>;

export type Outlier = {
  platform: "youtube";
  videoId: string;
  url: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  views: number;
  channelMedianViews: number;
  multiple: number; // views / channel median
  durationSeconds: number;
  publishedAt: string;
  source: string; // "competitor: CapCut" or "search: ai video editing"
  recipe?: Recipe;
};

export type PoolVideo = { id: string; title: string; channelId: string; channelTitle: string; views: number };

export type Research = {
  niche: Niche | null;
  outliers: Outlier[]; // best first; the watched ones carry a recipe
  // Niche channels research already looked at (not competitors), with their most-watched
  // recent videos. Outreach picks creators from these instead of searching again.
  pool?: PoolVideo[];
  notes: string[]; // what went wrong, shown nowhere, useful in logs
};
