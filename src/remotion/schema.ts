import { z } from "zod";

// The contract between the AI side (Claude writes `Script`) and the video side
// (Remotion renders `VideoProps`). Change it here and both sides follow.

export const FORMATS = ["hook_demo", "problem_fix", "three_reasons"] as const;
export const FormatId = z.enum(FORMATS);
export type FormatId = z.infer<typeof FormatId>;

// The motion-design scenes a shot can be. Each one is a real animation in
// src/remotion/scenes, modelled on what winning product Shorts actually do.
export const SCENES = [
  "type", // big kinetic text only (hooks, turning points)
  "panel", // the product (screenshot / image) floating in 3D, scrolling
  "prompt", // a prompt box types a request, send is pressed, the result pops in
  "fan", // one image bursts into a fan of variations ("one photo -> a whole campaign")
  "focus", // camera dives into a real button/section of the site, cursor clicks it
  "checklist", // features slam in one per beat with drawn check marks
  "before_after", // split wipe from the problem to the fix
  "logo", // logo + line
] as const;
export const SceneId = z.enum(SCENES);
export type SceneId = z.infer<typeof SceneId>;

export const Shot = z.object({
  scene: SceneId,
  // Index into the job's asset list (images / screenshots), -1 if the scene needs none.
  assetIndex: z.number().int(),
  // before_after: the "after" image. -1 to reuse assetIndex.
  secondAssetIndex: z.number().int(),
  // focus: index into the site's elements (buttons, headings, cards), -1 otherwise.
  elementIndex: z.number().int(),
  // Big on-screen text. Short: 2 to 7 words.
  onScreenText: z.string(),
  // One word from onScreenText to highlight in the brand colour ("" for none).
  highlight: z.string(),
  // What the voice says during this shot. One short sentence.
  voiceLine: z.string(),
  // "problem" shots get a washed-out look so the fix lands harder.
  mood: z.enum(["problem", "neutral", "solution"]),
  // prompt: what gets typed into the prompt box ("" otherwise).
  prompt: z.string(),
  // checklist: 3 to 5 short items. fan: 3 to 5 labels for the variations. before_after: ["Before label", "After label"]. [] otherwise.
  items: z.array(z.string()),
});
export type Shot = z.infer<typeof Shot>;

export const Script = z.object({
  format: FormatId,
  // "dark": the cinematic launch-film stage. "light": airy, soft, white cards (CapCut-style).
  theme: z.enum(["dark", "light"]),
  title: z.string(), // internal name, e.g. "The 3 a.m. invoice problem"
  shots: z.array(Shot),
  cta: z.string(), // end card line, e.g. "Try it free at acme.com"
  // Which winning video's recipe this follows (index into research outliers), -1 if none.
  basedOn: z.number().int(),
  postCaption: z.string(), // caption to paste when posting
  hashtags: z.array(z.string()),
});
export type Script = z.infer<typeof Script>;

export const Brand = z.object({
  name: z.string(),
  tagline: z.string(),
  primary: z.string(), // hex
  background: z.string(), // hex
  text: z.string(), // hex
});
export type Brand = z.infer<typeof Brand>;

export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type Asset = {
  url: string; // relative (/api/files/...) in the app, absolute when rendering
  kind: "screenshot_full" | "screenshot_hero" | "image";
  width: number;
  height: number;
  label: string; // what Claude was told this asset is
};

export type SiteElement = { label: string; kind: "button" | "heading" | "card" | "image"; x: number; y: number; w: number; h: number };

export type VideoProps = {
  script: Script;
  brand: Brand;
  logoUrl: string | null;
  assets: Asset[];
  // Boxes of real page parts inside the full-page screenshot (asset kind screenshot_full).
  elements: SiteElement[];
  voiceUrl: string | null;
  musicUrl: string | null;
  captions: Caption[];
  // When each shot starts, in ms from the top. Same length as script.shots.
  shotStartsMs: number[];
  durationMs: number;
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const END_CARD_MS = 2200;
