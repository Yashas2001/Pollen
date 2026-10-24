import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isAdmin, type AuthUser } from "./auth";
import { listJobs } from "./jobs";
import { DATA_ROOT } from "./links";

// Free runs per Google account; past that, the Pro waitlist. Failed runs don't count.
// Admins have no limit.

const FREE_RUNS = Number(process.env.FREE_RUNS ?? 2);
// Runs before this time don't count (e.g. launch time, so test runs from earlier are free).
const SINCE = process.env.FREE_RUNS_SINCE ? Date.parse(process.env.FREE_RUNS_SINCE) || 0 : 0;
const HITS_FILE = path.join(DATA_ROOT, "limit-hits.jsonl");
const PRO_FILE = path.join(DATA_ROOT, "pro-waitlist.jsonl");

export type RunAllowance = { left: number | null; freeRuns: number; onWaitlist: boolean };

export async function runAllowance(user: AuthUser): Promise<RunAllowance> {
  const onWaitlist = (await readJsonl(PRO_FILE)).some((e) => e.uid === user.uid);
  if (isAdmin(user)) return { left: null, freeRuns: FREE_RUNS, onWaitlist };
  const mine = (await listJobs()).filter((j) => j.step !== "failed" && j.owner?.uid === user.uid && Date.parse(j.createdAt) >= SINCE);
  return { left: Math.max(0, FREE_RUNS - mine.length), freeRuns: FREE_RUNS, onWaitlist };
}

type Entry = { uid: string; email: string; at: string };

async function readJsonl(file: string): Promise<Entry[]> {
  const text = await readFile(file, "utf8").catch(() => "");
  const byUser = new Map<string, Entry>();
  for (const line of text.split("\n")) {
    try {
      const e = JSON.parse(line) as Entry;
      byUser.set(e.uid, e);
    } catch {
      // Blank or half-written line.
    }
  }
  return [...byUser.values()];
}

async function append(file: string, user: AuthUser) {
  await mkdir(DATA_ROOT, { recursive: true });
  await appendFile(file, JSON.stringify({ uid: user.uid, email: user.email, at: new Date().toISOString() }) + "\n");
}

// Tried another run after the free ones: demand proof, read by /api/admin.
export const recordLimitHit = (user: AuthUser) => append(HITS_FILE, user);
export const readLimitHits = () => readJsonl(HITS_FILE);

export const joinProWaitlist = (user: AuthUser) => append(PRO_FILE, user);
export const readProWaitlist = () => readJsonl(PRO_FILE);

// Check-then-create one at a time, so two quick clicks can't both slip past the limit.
const g = globalThis as { __runLock?: Promise<unknown> };
export function withRunLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__runLock ?? Promise.resolve()).then(fn);
  g.__runLock = run.catch(() => {});
  return run;
}
