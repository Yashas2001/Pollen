import { appendFile, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomInt } from "node:crypto";
import path from "node:path";

// Tracked links: every caption and reply carries its own /r/<code> link, so the
// scoreboard can show which post brought clicks.
// Owner: Teammate B. Also src/app/r/[code]/ and src/app/v/[id]/Scoreboard.tsx + EarlyAccess.tsx.

export type LinkChannel = "tiktok" | "reels" | "shorts" | "x" | "reddit" | "hn" | "linkedin" | "other";

export type TrackedLink = {
  code: string;
  jobId: string;
  channel: LinkChannel;
  label: string; // human name for the scoreboard, e.g. "Video 1: before/after" or "Reply to @sam on X"
  target: string; // where the click goes (the product's site)
  createdAt: string;
};

export type LinkStats = {
  totalClicks: number;
  links: (TrackedLink & { clicks: number; lastClickAt: string | null })[];
  byChannel: Record<string, number>;
};

export type Click = { code: string; jobId: string; at: string; referrer: string | null; ua: string | null; country?: string };

// data/ (not data/jobs/): links and clicks span jobs.
export const DATA_ROOT = path.join(process.cwd(), "data");
const LINKS_FILE = path.join(DATA_ROOT, "links.json");
const CLICKS_FILE = path.join(DATA_ROOT, "clicks.jsonl");

// No look-alikes: 0/O, 1/l/I.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

async function readLinks(): Promise<Record<string, TrackedLink>> {
  try {
    return JSON.parse(await readFile(LINKS_FILE, "utf8")) as Record<string, TrackedLink>;
  } catch {
    return {};
  }
}

// One in-process queue: every read-modify-write of links.json waits for the one
// before it, so links made at the same moment never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export async function makeLink(
  jobId: string,
  link: { channel: LinkChannel; label: string; target: string },
): Promise<{ code: string; url: string }> {
  const code = await serial(async () => {
    const links = await readLinks();
    // Same job + same label -> same link.
    const existing = Object.values(links).find((l) => l.jobId === jobId && l.label === link.label);
    if (existing) return existing.code;
    let code = newCode();
    while (links[code]) code = newCode();
    links[code] = { code, jobId, ...link, createdAt: new Date().toISOString() };
    await mkdir(DATA_ROOT, { recursive: true });
    await writeFile(`${LINKS_FILE}.tmp`, JSON.stringify(links, null, 2));
    await rename(`${LINKS_FILE}.tmp`, LINKS_FILE);
    return code;
  });
  return { code, url: `${process.env.APP_URL}/r/${code}` };
}

export async function getLink(code: string): Promise<TrackedLink | null> {
  return (await readLinks())[code] ?? null;
}

// One line per click. Appends are safe for parallel clicks.
export async function logClick(click: Click) {
  await mkdir(DATA_ROOT, { recursive: true });
  await appendFile(CLICKS_FILE, JSON.stringify(click) + "\n");
}

async function readClicks(): Promise<Click[]> {
  let text = "";
  try {
    text = await readFile(CLICKS_FILE, "utf8");
  } catch {
    return [];
  }
  const clicks: Click[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      clicks.push(JSON.parse(line) as Click);
    } catch {
      // A half-written line: skip it, keep the rest.
    }
  }
  return clicks;
}

export async function getStats(jobId: string): Promise<LinkStats> {
  const [links, clicks] = await Promise.all([readLinks(), readClicks()]);
  const mine = Object.values(links).filter((l) => l.jobId === jobId);
  const rows = mine.map((l) => ({ ...l, clicks: 0, lastClickAt: null as string | null }));
  const byCode = new Map(rows.map((r) => [r.code, r]));
  for (const c of clicks) {
    const row = byCode.get(c.code);
    if (!row || c.jobId !== jobId) continue;
    row.clicks++;
    if (!row.lastClickAt || c.at > row.lastClickAt) row.lastClickAt = c.at;
  }
  rows.sort((a, b) => b.clicks - a.clicks || (b.lastClickAt ?? "").localeCompare(a.lastClickAt ?? ""));
  const byChannel: Record<string, number> = {};
  for (const r of rows) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + r.clicks;
  return { totalClicks: rows.reduce((n, r) => n + r.clicks, 0), links: rows, byChannel };
}
