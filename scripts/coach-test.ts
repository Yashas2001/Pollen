import { readFile } from "node:fs/promises";
import { coach } from "@/lib/people/coach";
import type { Person } from "@/lib/people/types";

// Runs the AgenticOrg Reply Coach on the people from a saved job: npx tsx --env-file=.env.local scripts/coach-test.ts <jobId>
async function main() {
  const job = JSON.parse(await readFile(`data/jobs/${process.argv[2]}/job.json`, "utf8")) as { people: Person[] };
  const t = Date.now();
  const out = await coach(job.people.slice(0, 3), "cubix.design");
  for (const p of out) console.log(p.url, "\n ", p.coach ?? "NO VERDICT", "\n  reply:", p.reply.slice(0, 200));
  console.log(`${job.people.slice(0, 3).length} in, ${out.length} out, ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
void main();
