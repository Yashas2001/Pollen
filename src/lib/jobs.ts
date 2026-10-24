import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
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
  render: { status: "none" | "rendering" | "done" | "failed"; file?: string; error?: string };
};

export type Job = {
  id: string;
  createdAt: string;
  url: string;
  step: JobStep;
  error?: string;
  research?: Research;
  plan?: Plan;
  videos: JobVideo[];
  // People finder runs beside the videos and never blocks "ready".
  peopleStatus?: "finding" | "done" | "failed";
  people?: Person[];
};

export const jobDir = (id: string) => path.join(DATA_DIR, id);
export const fileUrl = (id: string, name: string) => `/api/files/${id}/${name}`;

export async function createJob(url: string): Promise<Job> {
  const job: Job = { id: randomUUID().slice(0, 8), createdAt: new Date().toISOString(), url, step: "queued", videos: [] };
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
  await writeFile(`${file}.tmp`, JSON.stringify(job, null, 2));
  await rename(`${file}.tmp`, file);
}

export async function updateJob(id: string, change: (job: Job) => void): Promise<Job> {
  const job = await getJob(id);
  if (!job) throw new Error(`Job ${id} not found`);
  change(job);
  await saveJob(job);
  return job;
}
