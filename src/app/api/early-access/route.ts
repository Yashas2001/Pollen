import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT } from "@/lib/links";

// "Connect account" only logs interest: it is our demand proof. Nothing launches.
const FILE = path.join(DATA_ROOT, "early-access.jsonl");
const CHANNELS = ["meta", "google", "email", "creators", "autopost"];

type Entry = { jobId: string; channel: string; at: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { jobId?: unknown; channel?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const channel = typeof body?.channel === "string" ? body.channel : "";
  if (!/^[a-z0-9-]+$/i.test(jobId) || !CHANNELS.includes(channel)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const entry: Entry = { jobId, channel, at: new Date().toISOString() };
  await mkdir(DATA_ROOT, { recursive: true });
  await appendFile(FILE, JSON.stringify(entry) + "\n");
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  let text = "";
  try {
    text = await readFile(FILE, "utf8");
  } catch {
    // No requests yet.
  }
  const channels = new Set<string>();
  for (const line of text.split("\n")) {
    try {
      const e = JSON.parse(line) as Entry;
      if (e.jobId === jobId) channels.add(e.channel);
    } catch {
      // Blank or half-written line.
    }
  }
  return Response.json({ channels: [...channels] }, { headers: { "Cache-Control": "no-store" } });
}
