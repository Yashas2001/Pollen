import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { writeFile } from "node:fs/promises";
import type { Caption, Script } from "@/remotion/schema";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";

// Each ElevenLabs key only allows a few requests at once. With many people using the
// app together, calls are spread over every key we have, a couple at a time per key,
// and a "too many" answer is retried on the next free key.
const KEYS = (process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
const PER_KEY = 2;
// Short timeout + retries: venue wifi drops; a 5-minute hang is worse than a quick retry.
// A key that runs out of credits is benched for an hour and the request moves on.
const pool = KEYS.map((apiKey) => ({ client: new ElevenLabsClient({ apiKey, timeoutInSeconds: 45, maxRetries: 2 }), busy: 0, emptyUntil: 0 }));
const waiting: (() => void)[] = [];

const free = () =>
  pool.filter((p) => p.busy < PER_KEY && p.emptyUntil < Date.now()).sort((a, b) => a.busy - b.busy)[0];

export async function withVoiceClient<T>(fn: (client: ElevenLabsClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (pool.every((p) => p.emptyUntil >= Date.now())) throw new Error("Every ElevenLabs key is out of credits.");
    let slot = free();
    while (!slot) {
      await new Promise<void>((resolve) => waiting.push(resolve));
      slot = free();
    }
    slot.busy++;
    try {
      return await fn(slot.client);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const empty = status === 401 && /quota_exceeded|credits/i.test(JSON.stringify((e as { body?: unknown }).body ?? (e as Error).message));
      if (empty) {
        slot.emptyUntil = Date.now() + 60 * 60_000;
        console.warn(`[voice] key ${pool.indexOf(slot) + 1} is out of credits, using the others`);
        continue;
      }
      if (status !== 429 || attempt >= 6) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      slot.busy--;
      waiting.shift()?.();
    }
  }
}
const SHOT_GAP = " "; // between voice lines; the voice pauses on the sentence end anyway

export type Voiceover = {
  captions: Caption[];
  shotStartsMs: number[];
  durationMs: number;
};

// One voice take per video (sounds natural, one API call), then the character
// timings tell us where each shot starts and give word-level captions for free.
export async function makeVoiceover(script: Script, outPath: string): Promise<Voiceover> {
  const lines = script.shots.map((s) => s.voiceLine.trim());
  const text = lines.join(SHOT_GAP);

  const res = await withVoiceClient((eleven) =>
    eleven.textToSpeech.convertWithTimestamps(VOICE_ID, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    }),
  );
  await writeFile(outPath, Buffer.from(res.audioBase64, "base64"));

  const a = res.alignment;
  if (!a) throw new Error("ElevenLabs returned no timings.");
  const startMs = (i: number) => Math.round(a.characterStartTimesSeconds[Math.min(i, a.characterStartTimesSeconds.length - 1)] * 1000);
  const endMs = (i: number) => Math.round(a.characterEndTimesSeconds[Math.min(i, a.characterEndTimesSeconds.length - 1)] * 1000);

  // Shot starts: the first character of each line. Shot 0 starts at 0.
  const shotStartsMs: number[] = [];
  let offset = 0;
  lines.forEach((line, i) => {
    shotStartsMs.push(i === 0 ? 0 : Math.max(0, startMs(offset) - 120));
    offset += line.length + SHOT_GAP.length;
  });

  // Words: group characters between spaces. Leading space on every word but the
  // first, which is what @remotion/captions expects for TikTok-style pages.
  const captions: Caption[] = [];
  let word = "";
  let wordStart = -1;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (word) captions.push(toCaption(word, wordStart, endMs(i - 1), captions.length));
      word = "";
      wordStart = -1;
      return;
    }
    if (wordStart < 0) wordStart = startMs(i);
    word += ch;
  });
  if (word) captions.push(toCaption(word, wordStart, endMs(a.characters.length - 1), captions.length));

  const durationMs = endMs(a.characters.length - 1) + 250;
  return { captions, shotStartsMs, durationMs };
}

function toCaption(word: string, start: number, end: number, index: number): Caption {
  return {
    text: index === 0 ? word : ` ${word}`,
    startMs: start,
    endMs: end,
    timestampMs: Math.round((start + end) / 2),
    confidence: 1,
  };
}
