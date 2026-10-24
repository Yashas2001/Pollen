import { after } from "next/server";
import { activeRenders, getJob, updateJob } from "@/lib/jobs";
import { renderVideo } from "@/lib/render";

export const maxDuration = 600;

// Starts the MP4 render; the page polls the job until render.status is "done".
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { index } = (await request.json().catch(() => ({}))) as { index?: number };
  const job = await getJob(id);
  if (!job || typeof index !== "number" || !job.videos[index]) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  // "rendering" with nothing running here means a restart cut it off: start it again.
  const key = `${id}/${index}`;
  if (job.videos[index].render.status !== "done" && !activeRenders.has(key)) {
    // Say "rendering" before answering: the page reloads the job right away and only keeps
    // polling while something is rendering, so a late status left the button looking dead.
    activeRenders.add(key);
    try {
      await updateJob(id, (j) => void (j.videos[index].render = { status: "rendering" }));
    } catch (e) {
      activeRenders.delete(key);
      throw e;
    }
    after(() => renderVideo(id, index));
  }
  return Response.json({ ok: true });
}
