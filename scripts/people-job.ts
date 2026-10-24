import { readFile } from "node:fs/promises";
import { findPeople } from "@/lib/people";
import type { Job } from "@/lib/jobs";

// Re-runs the people finder for a saved job (no videos), optionally with a corrected "what":
// npx tsx --env-file=.env.local scripts/people-job.ts <jobId> ["what it is"]
async function main() {
  const j = JSON.parse(await readFile(`data/jobs/${process.argv[2]}/job.json`, "utf8")) as Job;
  const n = j.research?.niche;
  const t = Date.now();
  const people = await findPeople("test", {
    url: j.url,
    ...j.plan!.brief,
    ...(process.argv[3] ? { what: process.argv[3] } : {}),
    niche: n?.niche ?? null,
    audience: n?.audience ?? null,
    competitors: n?.competitors.map((c) => c.name) ?? [],
  });
  for (const p of people) console.log(p.kind, p.platform, p.score, p.url, "|", p.why);
  console.log(`${people.length} people in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
void main();
