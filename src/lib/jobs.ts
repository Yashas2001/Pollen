import { mkdir, readFile, readdir, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { VideoProps } from "@/remotion/schema";
import type { Plan } from "./writer";
import type { Research } from "./research/types";
import type { Person } from "./people/types";

// Jobs live on disk under data/jobs/<id>/: job.json plus every file the job makes.
// Good enough for one laptop today; swap for a DB + bucket later.

export const DATA_DIR = path.join(process.cwd(), "data", "jobs");

export type JobStep = "queued" | "reading_site" | "researching" | "writing" | "voicing" | "ready" | "failed";

export type JobVideo = {
  props: VideoProps;
  render: { status: "none" | "rendering" | "done" | "failed"; file?: string; error?: string; progress?: number }; // progress: 0-100, only while rendering
};

export type Job = {
  id: string;
  createdAt: string;
  url: string;
  goal: string; // what they asked for, e.g. "I need my first 50 users"
  owner?: { uid: string; email: string; name: string }; // who ran it (Google sign in)
  step: JobStep;
  error?: string;
  research?: Research;
  plan?: Plan;
  videos: JobVideo[];
  // Tracked link-in-bio per platform (captions on TikTok / Reels / Shorts aren't clickable).
  bioLinks?: { channel: "tiktok" | "reels" | "shorts"; url: string }[];
  // People finder runs beside the videos and never blocks "ready".
  peopleStatus?: "finding" | "done" | "failed";
  people?: Person[];
};

export const jobDir = (id: string) => path.join(DATA_DIR, id);
export const fileUrl = (id: string, name: string) => `/api/files/${id}/${name}`;

export async function createJob(url: string, goal: string, owner: Job["owner"]): Promise<Job> {
  const job: Job = { id: randomUUID().slice(0, 8), createdAt: new Date().toISOString(), url, goal, owner, step: "queued", videos: [] };
  await mkdir(jobDir(job.id), { recursive: true });
  await saveJob(job);
  return job;
}

export async function getJob(id: string): Promise<Job | null> {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(jobDir(id), "job.json"), "utf8")) as Job;
  } catch {
    return null;
  }
}

export async function saveJob(job: Job) {
  const file = path.join(jobDir(job.id), "job.json");
  const tmp = `${file}.${randomUUID().slice(0, 6)}.tmp`;
  await writeFile(tmp, JSON.stringify(job, null, 2));
  // Windows refuses to replace job.json while another request is reading it (EPERM/EBUSY),
  // and the page reads it every 1.5 s. Retry for up to ~1 s instead of dropping the update.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, file);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 9 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        await rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

// Several parts of a job update it at once (research, people finder, renders), so
// updates to one job run one after another; otherwise one read-modify-write loses the other.
// On globalThis because Next can load this module once per route.
const queues: Map<string, Promise<unknown>> = ((globalThis as { __jobQueues?: Map<string, Promise<unknown>> }).__jobQueues ??=
  new Map());

export function updateJob(id: string, change: (job: Job) => void): Promise<Job> {
  const run = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const job = await getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    change(job);
    await saveJob(job);
    return job;
  });
  queues.set(id, run);
  void run.finally(() => queues.get(id) === run && queues.delete(id)).catch(() => {});
  return run;
}

// Renders ("<id>/<index>" -> percent done) queued or running in this server; kept in memory so
// progress never touches job.json. job.json saying "rendering" for one that isn't here means a
// restart cut it off. On globalThis because Next can load this module once per route.
export const activeRenders: Map<string, number> = ((globalThis as { __activeRenders?: Map<string, number> }).__activeRenders ??= new Map());

// Every job, newest first. Fine for an event's worth of jobs; a DB later.
export async function listJobs(): Promise<Job[]> {
  const ids = await readdir(DATA_DIR).catch(() => [] as string[]);
  const jobs = (await Promise.all(ids.map(getJob))).filter((j): j is Job => !!j);
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
