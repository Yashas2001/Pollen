import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { withVoiceClient } from "./voice";

// Real footage: videos already on the site, and clips people upload (them talking,
// the product in use). Everything gets turned into the same small H.264 MP4 so the
// preview player and the renderer both read it, then described so the writer knows
// what is in each second.

const execFileP = promisify(execFile);

export type Footage = {
  file: string; // inside the job dir
  width: number;
  height: number;
  durationSec: number;
  hasAudio: boolean;
  label: string; // what the writer is told it is
  source?: string; // original file name, often says what it shows ("beat-edit.mp4")
  captions?: boolean; // words already burned into the picture
};

export type Word = { text: string; start: number; end: number };

const MAX_SEC = 60;

async function probe(file: string) {
  const { stdout } = await execFileP("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(stdout) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration?: string } };
  const v = j.streams.find((s) => s.codec_type === "video");
  return {
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    durationSec: Number(j.format.duration ?? 0),
    hasAudio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

// Any phone/screen/site video -> H.264 MP4 that fits inside 1080x1920, 30 fps,
// upright (phones store rotation as metadata), at most a minute.
export async function prepVideo(src: string, out: string, label: string): Promise<Footage | null> {
  try {
    await execFileP(
      "ffmpeg",
      [
        "-v", "error", "-y", "-i", src, "-t", String(MAX_SEC),
        "-vf", "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", out,
      ],
      { timeout: 180_000 },
    );
    const p = await probe(out);
    if (!p.width || p.durationSec < 0.5) return null;
    return { file: path.basename(out), ...p, label };
  } catch (e) {
    console.warn("[footage] prep failed", path.basename(src), (e as Error).message.slice(0, 200));
    return null;
  }
}

// Site videos: download (capped), then prep. Never throws.
export async function grabSiteVideos(urls: string[], dir: string, max = 3): Promise<Footage[]> {
  const out: Footage[] = [];
  for (const [i, url] of urls.slice(0, 6).entries()) {
    if (out.length >= max) break;
    const raw = path.join(dir, `sitevid-${i}.src`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const len = Number(res.headers.get("content-length") ?? 0);
      if (!res.ok || len > 80_000_000) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20_000 || buf.length > 80_000_000) continue;
      await writeFile(raw, buf);
      const f = await prepVideo(raw, path.join(dir, `sitevid-${i}.mp4`), "a video from the site");
      if (f) out.push({ ...f, source: decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").slice(0, 60) });
    } catch (e) {
      console.warn("[footage] site video failed", url.slice(0, 120), (e as Error).message.slice(0, 120));
    } finally {
      await unlink(raw).catch(() => {});
    }
  }
  return out;
}

// What happens in a clip, second by second, so the writer can pick the right moments.
// For uploads it also tells us whether it's someone talking to camera (their own or
// past UGC) or footage of the product. Gemini watches a small copy, not the original.
export async function describeFootage(dir: string, f: Footage, kind: "upload" | "site"): Promise<{ face: boolean; captions: boolean; text: string }> {
  const small = path.join(dir, `${f.file}.small.mp4`);
  try {
    await execFileP("ffmpeg", ["-v", "error", "-y", "-i", path.join(dir, f.file), "-vf", "scale=360:-2,fps=5", "-c:v", "libx264", "-crf", "32", "-preset", "veryfast", "-c:a", "aac", "-b:a", "48k", "-ac", "1", small], { timeout: 120_000 });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 60_000 } });
    const ask =
      (kind === "upload"
        ? "Line 1: FACE if a person talks to the camera at any point, otherwise NOFACE.\nLine 2: CAPTIONS if subtitles or words are burned into the video while someone speaks, otherwise NOCAPTIONS.\nThen "
        : "") +
      "describe what is visible in time ranges, like '0-3s: ...'. Be concrete: when a person is on camera and when the product is shown, which screen of the product, what gets clicked or changes, what the product does. Max 8 lines.";
    const res = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: (await readFile(small)).toString("base64") } }, { text: ask }] }],
    });
    const raw = (res.text ?? "").trim();
    const lines = raw.split("\n");
    const head = kind === "upload" ? lines.slice(0, 2).join(" ") : "";
    const face = /\bFACE\b/.test(head) && !/\bNOFACE\b/.test(head);
    const captions = /\bCAPTIONS\b/.test(head) && !/\bNOCAPTIONS\b/.test(head);
    const text = (kind === "upload" ? lines.slice(2) : lines).join("\n").trim().slice(0, 900);
    return { face, captions, text };
  } catch (e) {
    console.warn("[footage] describe failed", f.file, (e as Error).message.slice(0, 160));
    return { face: false, captions: false, text: "" };
  } finally {
    await unlink(small).catch(() => {});
  }
}

// Their photos: upright JPEG, at most 1600 px, plus a one-line description.
export async function prepImage(src: string, out: string): Promise<{ file: string; width: number; height: number; label: string } | null> {
  try {
    await execFileP("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", "scale='min(1600,iw)':-2", "-frames:v", "1", "-q:v", "3", out], { timeout: 60_000 });
    const p = await probe(out);
    if (!p.width) return null;
    let label = "their photo";
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 40_000 } });
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: (await readFile(out)).toString("base64") } }, { text: "One line: what this image shows (product shot, app screen, person, lifestyle...). Be concrete." }] }],
      });
      if (res.text) label = `their photo: ${res.text.trim().slice(0, 200)}`;
    } catch {
      // the label stays generic
    }
    return { file: path.basename(out), width: p.width, height: p.height, label };
  } catch (e) {
    console.warn("[footage] image failed", path.basename(src), (e as Error).message.slice(0, 160));
    return null;
  }
}

// Word timings for a talking clip (ElevenLabs Scribe, through the shared key pool).
// keyterms: the product's name, so "Cubix" doesn't come back as "Cubics".
export async function transcribe(dir: string, f: Footage, keyterms: string[] = []): Promise<Word[]> {
  try {
    const res = (await withVoiceClient((client) =>
      client.speechToText.convert(
        {
          modelId: "scribe_v2",
          file: createReadStream(path.join(dir, f.file)),
          timestampsGranularity: "word",
          tagAudioEvents: false,
          ...(keyterms.length ? { keyterms } : {}),
        },
        { timeoutInSeconds: 120 },
      ),
    )) as { words?: { text: string; start?: number; end?: number; type: string }[] };
    return (res.words ?? [])
      .filter((w) => w.type === "word" && w.start !== undefined && w.end !== undefined)
      .map((w) => ({ text: w.text.trim(), start: w.start!, end: w.end! }));
  } catch (e) {
    console.warn("[footage] transcribe failed", (e as Error).message.slice(0, 200));
    return [];
  }
}

// Split words into phrases at sentence ends and pauses: the units a video can cut on.
export type Phrase = { text: string; start: number; end: number; words: Word[] };
export function toPhrases(words: Word[]): Phrase[] {
  const out: Phrase[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) out.push({ text: cur.map((w) => w.text).join(" "), start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const gap = next ? next.start - w.end : 1;
    const span = w.end - cur[0].start;
    if (/[.!?]$/.test(w.text) || gap > 0.45 || (/[,;:]$/.test(w.text) && span > 2.5) || span > 6) flush();
  });
  flush();
  return out;
}

// Cut the chosen phrases out of their talking clips (in the writer's order) and
// join them into one voice track.
export async function cutVoice(segments: { src: string; start: number; end: number }[], out: string) {
  const srcs = [...new Set(segments.map((s) => s.src))];
  const parts = segments.map((s, i) => `[${srcs.indexOf(s.src)}:a]atrim=${s.start.toFixed(3)}:${s.end.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, s.end - s.start - 0.03).toFixed(3)}:d=0.03[a${i}]`);
  const filter = `${parts.join(";")};${segments.map((_, i) => `[a${i}]`).join("")}concat=n=${segments.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`;
  await execFileP("ffmpeg", ["-v", "error", "-y", ...srcs.flatMap((f) => ["-i", f]), "-filter_complex", filter, "-map", "[out]", "-ar", "44100", "-b:a", "160k", out], { timeout: 120_000 });
}
