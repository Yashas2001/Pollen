import { after } from "next/server";
import { getJob } from "@/lib/jobs";
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
  const status = job.videos[index].render.status;
  if (status !== "rendering" && status !== "done") {
    after(() => renderVideo(id, index));
  }
  return Response.json({ ok: true });
}
