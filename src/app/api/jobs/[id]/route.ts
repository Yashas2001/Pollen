import { activeRenders, getJob } from "@/lib/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  // A render a restart cut off would say "Making your MP4..." forever; offer to try again instead.
  job.videos.forEach((v, i) => {
    if (v.render.status === "rendering" && !activeRenders.has(`${id}/${i}`)) v.render = { status: "failed", error: "Interrupted" };
  });
  return Response.json(job, { headers: { "Cache-Control": "no-store" } });
}
