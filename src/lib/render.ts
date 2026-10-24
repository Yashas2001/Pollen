import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import type { VideoProps } from "@/remotion/schema";
import { activeRenders, jobDir, updateJob, getJob } from "./jobs";

// Prebuilt by `npm run bundle` (runs before dev/build). Remotion's bundler uses
// webpack, so it must not run inside a Next route.
const SERVE_URL = path.join(process.cwd(), ".remotion-bundle");
const COMPOSITION_ID = "SocialVideo";
// Remotion serves the bundle on its own port; left alone it can pick 3000 and collide with Next.
const REMOTION_PORT = 3123;

// Headless Chrome loads the job files over HTTP, so relative /api/files/... paths
// become absolute against the app's own URL.
function absolutize(props: VideoProps): VideoProps {
  // The renderer fetches job files from this same server, not through the public address.
  const base = `http://localhost:${process.env.PORT ?? 3000}`;
  const abs = (u: string | null) => (u && u.startsWith("/") ? `${base}${u}` : u);
  return {
    ...props,
    logoUrl: abs(props.logoUrl),
    voiceUrl: abs(props.voiceUrl),
    musicUrl: abs(props.musicUrl),
    assets: props.assets.map((a) => ({ ...a, url: abs(a.url)! })),
  };
}

// One render at a time: a laptop has one Chrome's worth of CPU to spare.
let queue: Promise<unknown> = Promise.resolve();

export function renderVideo(id: string, index: number): Promise<void> {
  const key = `${id}/${index}`;
  activeRenders.add(key);
  const run = async () => {
    const job = await getJob(id);
    const video = job?.videos[index];
    if (!job || !video) throw new Error("No such video");
    const file = `video-${index}.mp4`;
    await updateJob(id, (j) => void (j.videos[index].render = { status: "rendering" }));
    try {
      const inputProps = absolutize(video.props);
      const composition = await selectComposition({ serveUrl: SERVE_URL, id: COMPOSITION_ID, inputProps, port: REMOTION_PORT });
      await renderMedia({
        composition,
        serveUrl: SERVE_URL,
        codec: "h264",
        outputLocation: path.join(jobDir(id), file),
        inputProps,
        port: REMOTION_PORT,
      });
      await updateJob(id, (j) => void (j.videos[index].render = { status: "done", file }));
    } catch (err) {
      console.error(`[render ${id}/${index}]`, err);
      const error = err instanceof Error ? err.message : String(err);
      await updateJob(id, (j) => void (j.videos[index].render = { status: "failed", error }));
    }
  };
  const next = queue.then(run, run).finally(() => activeRenders.delete(key));
  queue = next.catch(() => {});
  return next;
}
