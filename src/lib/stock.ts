import path from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { prepVideo, type Footage } from "./footage";

// Stock footage from Pexels (free to use) for videos where they gave us nothing of
// their own: people, places and moods that set up the product. One download per query.

type PexelsFile = { link: string; width: number; height: number; file_type: string };
type PexelsVideo = { id: number; duration: number; video_files: PexelsFile[] };

export async function fetchStock(query: string, dir: string, n: number): Promise<Footage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const url = `https://api.pexels.com/videos/search?${new URLSearchParams({ query, orientation: "portrait", size: "medium", per_page: "6" })}`;
    const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const { videos } = (await res.json()) as { videos: PexelsVideo[] };
    // a few seconds of usable footage, vertical, a file small enough to pull quickly
    const pick = videos
      .filter((v) => v.duration >= 4 && v.duration <= 60)
      .map((v) => ({
        v,
        file: v.video_files
          .filter((f) => f.file_type === "video/mp4" && f.height >= 1000 && f.height >= f.width)
          .sort((a, b) => a.height - b.height)[0],
      }))
      .find((x) => x.file);
    if (!pick) return null;
    const raw = path.join(dir, `stock-${n}.src.mp4`);
    const body = await fetch(pick.file.link, { signal: AbortSignal.timeout(40_000) });
    if (!body.ok) return null;
    await writeFile(raw, Buffer.from(await body.arrayBuffer()));
    const f = await prepVideo(raw, path.join(dir, `stock-${n}.mp4`), `stock footage: ${query}`);
    await unlink(raw).catch(() => {});
    return f;
  } catch (e) {
    console.warn("[stock]", query, (e as Error).message.slice(0, 120));
    return null;
  }
}
