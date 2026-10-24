import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT } from "@/lib/links";

// Outreach has no links (cold messages ask for a reply, communities remove links), so
// the founder marks each message: sent, then got a reply. The scoreboard counts replies.

export type MarkChannel = "reddit" | "hn" | "x" | "linkedin" | "creator" | "partner";

export type Mark = {
  key: string; // the post, channel or website the message went to
  label: string; // e.g. "Reply to sam on Reddit", "Creator: Ali Abdaal"
  channel: MarkChannel;
  sent: boolean;
  replied: boolean;
  at: string;
};

const FILE = path.join(DATA_ROOT, "marks.json");

async function readAll(): Promise<Record<string, Record<string, Mark>>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Record<string, Record<string, Mark>>;
  } catch {
    return {};
  }
}

// Same one-at-a-time queue as links.ts, so two clicks never overwrite each other.
const g = globalThis as { __marksQueue?: Promise<unknown> };
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = (g.__marksQueue ?? Promise.resolve()).then(task, task);
  g.__marksQueue = run.catch(() => {});
  return run;
}

export async function getMarks(jobId: string): Promise<Mark[]> {
  return Object.values((await readAll())[jobId] ?? {});
}

export async function setMark(jobId: string, mark: Omit<Mark, "at">): Promise<Mark> {
  return serial(async () => {
    const all = await readAll();
    const saved = { ...mark, at: new Date().toISOString() };
    (all[jobId] ??= {})[mark.key] = saved;
    await mkdir(DATA_ROOT, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2));
    await rename(tmp, FILE);
    return saved;
  });
}
