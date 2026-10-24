import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isAdmin, type AuthUser } from "./auth";
import { listJobs } from "./jobs";
import { DATA_ROOT } from "./links";

// Free runs per Google account, and a cap on new runs per day so YouTube's daily quota
// (about 177 units a run, 10,000 a day) never runs dry mid-run. Failed runs don't count.
// Days follow YouTube's quota day: it resets at midnight Pacific.

const FREE_RUNS = Number(process.env.FREE_RUNS ?? 2);
const DAILY_RUNS = Number(process.env.DAILY_RUNS ?? 35);
const HITS_FILE = path.join(DATA_ROOT, "limit-hits.jsonl");

const quotaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

function hoursToReset(): number {
  const now = new Date();
  const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const midnight = new Date(pacific);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((midnight.getTime() - pacific.getTime()) / 3_600_000));
}

export type RunAllowance = { left: number | null; full: boolean; message: string | null };

export async function runAllowance(user: AuthUser): Promise<RunAllowance> {
  if (isAdmin(user)) return { left: null, full: false, message: null };
  const counted = (await listJobs()).filter((j) => j.step !== "failed");
  const left = Math.max(0, FREE_RUNS - counted.filter((j) => j.owner?.uid === user.uid).length);
  const today = quotaDay(new Date());
  const full = counted.filter((j) => quotaDay(new Date(j.createdAt)) === today).length >= DAILY_RUNS;
  const message = !left
    ? `You've used your ${FREE_RUNS} free runs. Your products below are still yours to open and use.`
    : full
      ? `Pollen is full for today. New runs open in about ${hoursToReset()} hours.`
      : null;
  return { left, full, message };
}

// Someone who wanted another run and couldn't: demand proof, read by /api/admin.
export async function recordLimitHit(user: AuthUser, reason: "used" | "full") {
  await mkdir(DATA_ROOT, { recursive: true });
  await appendFile(HITS_FILE, JSON.stringify({ uid: user.uid, email: user.email, reason, at: new Date().toISOString() }) + "\n");
}

// Everyone who hit a limit, once each (latest reason).
export async function readLimitHits(): Promise<{ uid: string; email: string; reason: string; at: string }[]> {
  const text = await readFile(HITS_FILE, "utf8").catch(() => "");
  const byUser = new Map<string, { uid: string; email: string; reason: string; at: string }>();
  for (const line of text.split("\n")) {
    try {
      const hit = JSON.parse(line);
      byUser.set(hit.uid, hit);
    } catch {
      // Blank or half-written line.
    }
  }
  return [...byUser.values()];
}

// Check-then-create one at a time, so two quick clicks can't both slip past the limit.
const g = globalThis as { __runLock?: Promise<unknown> };
export function withRunLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__runLock ?? Promise.resolve()).then(fn);
  g.__runLock = run.catch(() => {});
  return run;
}
