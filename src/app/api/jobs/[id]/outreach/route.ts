import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { getJob, type Job } from "@/lib/jobs";
import { DATA_ROOT } from "@/lib/links";
import { findOutreach } from "@/lib/outreach";
import type { Outreach } from "@/lib/outreach/types";

// Creators and businesses to reach out to. Made once per job (about a minute),
// then served from data/outreach/<id>.v2.json.

const DIR = path.join(DATA_ROOT, "outreach");

// Two people opening the page at once share one search.
const inFlight: Map<string, Promise<Outreach>> = ((globalThis as { __outreach?: Map<string, Promise<Outreach>> }).__outreach ??= new Map());

async function load(job: Job): Promise<Outreach> {
  // v2: messages without links. Older files still carry tracked links, so they are made again.
  const file = path.join(DIR, `${job.id}.v2.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as Outreach;
  } catch {
    // Not made yet.
  }
  const out = await findOutreach(job);
  // An empty list is usually a hiccup (quota, search): don't keep it, try again next open.
  if (out.creators.length && out.partners.length) {
    await mkdir(DIR, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(out, null, 2));
    await rename(`${file}.tmp`, file);
  }
  return out;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  if (job.step !== "ready") return Response.json({ error: "Not ready" }, { status: 409 });

  let pending = inFlight.get(id);
  if (!pending) {
    pending = load(job).finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  try {
    return Response.json(await pending, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[outreach] failed", err);
    return Response.json({ error: "Could not prepare" }, { status: 500 });
  }
}
