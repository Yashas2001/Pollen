import { after } from "next/server";
import { createJob } from "@/lib/jobs";
import { runJob } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim();
  if (!url || !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(url)) {
    return Response.json({ error: "Paste your product's website link." }, { status: 400 });
  }
  const job = await createJob(url);
  after(() => runJob(job.id, url));
  return Response.json({ id: job.id });
}
