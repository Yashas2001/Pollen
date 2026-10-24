import { getJob } from "@/lib/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(job, { headers: { "Cache-Control": "no-store" } });
}
