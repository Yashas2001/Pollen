import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Job } from "@/lib/jobs";
import { research } from "@/lib/research";
import type { Research } from "@/lib/research/types";
import { findCreators } from "@/lib/outreach";

// Re-runs research + creator finding for a saved job with its saved niche, and counts
// YouTube quota (search 100 units, everything else 1). Compare versions side by side:
// npx tsx --env-file=.env.local scripts/youtube-eval.ts <label> <jobId> [reuse-label]
async function main() {
  const [label, jobId] = process.argv.slice(2);
  const job = JSON.parse(await readFile(`data/jobs/${jobId}/job.json`, "utf8")) as Job;

  const calls: Record<string, number> = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const m = url.match(/youtube\/v3\/(\w+)/);
    if (m) calls[m[1]] = (calls[m[1]] ?? 0) + 1;
    return realFetch(input, init);
  };
  const units = () => Object.entries(calls).reduce((n, [k, c]) => n + c * (k === "search" ? 100 : 1), 0);

  // Optional 3rd arg: reuse another label's saved research and only redo creators.
  const reuse = process.argv[4];
  let t = Date.now();
  const r: Research = reuse
    ? JSON.parse(await readFile(`data/eval/${reuse}/${jobId}.research.json`, "utf8"))
    : await research({ url: job.url, title: "", description: "", text: "" }, async () => {}, job.research!.niche!);
  const researchSeconds = (Date.now() - t) / 1000;
  const researchUnits = units();

  const notes: string[] = [];
  t = Date.now();
  const creators = await findCreators({ ...job, research: r }, notes);
  const creatorSeconds = (Date.now() - t) / 1000;

  const out = {
    label,
    job: jobId,
    url: job.url,
    niche: r.niche?.niche,
    calls,
    units: { research: researchUnits, creators: units() - researchUnits, total: units() },
    seconds: { research: researchSeconds, creators: creatorSeconds },
    outliers: r.outliers.map((o) => ({
      title: o.title,
      channel: o.channel,
      views: o.views,
      multiple: o.multiple,
      source: o.source,
      url: o.url,
      recipe: o.recipe ? `${o.recipe.hookType}: ${o.recipe.whyItWorks}` : null,
    })),
    creators: creators.map((c) => ({ name: c.name, subscribers: c.subscribers, video: c.video.title, views: c.video.views, email: !!c.email, why: c.why })),
    notes: [...r.notes, ...notes],
  };
  await mkdir(`data/eval/${label}`, { recursive: true });
  await writeFile(`data/eval/${label}/${jobId}.json`, JSON.stringify(out, null, 2));
  await writeFile(`data/eval/${label}/${jobId}.research.json`, JSON.stringify(r));
  console.log(
    `${label} ${job.url}: ${out.units.total} units (research ${out.units.research}, creators ${out.units.creators}) | ${r.outliers.length} outliers, ${r.outliers.filter((o) => o.recipe).length} recipes | ${creators.length} creators, ${creators.filter((c) => c.email).length} emails | ${researchSeconds.toFixed(0)}+${creatorSeconds.toFixed(0)} s`,
  );
}
void main();
