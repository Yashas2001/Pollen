# Fix needed in `src/lib/jobs.ts` (for Suhas)

From Yashas. `jobs.ts` is your file. The fix below is committed on `people` as its own commit ("jobs: one update at a time per job...") so you can see the diff with `git show 3946860`. Review it before merging, or drop that commit and apply your own version.

## The bug

`updateJob` reads `job.json`, changes it, and writes it back. Nothing stops two updates on the same job from running at once, and the People finder now updates the job while the pipeline does. Research progress updates overlap too. Two things go wrong:

1. **Jobs crash.** Every write uses the same `job.json.tmp`. When two writes overlap, one renames the file away and the other fails with `ENOENT: rename job.json.tmp -> job.json`. The pipeline catches it and marks the job `failed`. **This happened on a real cubix.design run today**, at the "writing" step.
2. **Updates are lost.** Two overlapping updates both read the old job, and the second write overwrites the first. On another real run, `peopleStatus: "finding"` was overwritten, so `JobView` stopped polling and the People cards only appeared after a manual refresh. (The People section now polls on its own, so that symptom is covered, but the lost write is still a bug.)

## Proof

A test that fires 50 overlapping `updateJob` calls, each adding one item:

| `jobs.ts` | Threw | Updates kept |
|---|---|---|
| Current `main` | 44 of 50 (`ENOENT`) | **1 of 50** |
| With the fix below | 0 | **50 of 50** |

## The fix

Replace `saveJob` and `updateJob` at the bottom of `src/lib/jobs.ts`:

```ts
export async function saveJob(job: Job) {
  const file = path.join(jobDir(job.id), "job.json");
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(job, null, 2));
  await rename(tmp, file);
}

// One update at a time per job: the people finder updates the job while the pipeline does,
// and two overlapping read-change-write cycles would overwrite each other.
const queues = new Map<string, Promise<unknown>>();

export function updateJob(id: string, change: (job: Job) => void): Promise<Job> {
  const run = (queues.get(id) ?? Promise.resolve()).then(async () => {
    const job = await getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    change(job);
    await saveJob(job);
    return job;
  });
  queues.set(id, run.catch(() => {}));
  return run;
}
```

- `randomUUID` is already imported in `jobs.ts`.
- `updateJob` keeps the same signature and return type, so no caller changes.
- A failed update still rejects for its caller, and the next update on that job still runs.

## Check it

Save this as `scripts/jobs-race.mts` and run `npx tsx scripts/jobs-race.mts`. It should print `PASS 50 of 50`:

```ts
import { createJob, getJob, updateJob, jobDir } from "@/lib/jobs";
import { rm } from "node:fs/promises";

const job = await createJob("https://example.com");
await Promise.all(Array.from({ length: 50 }, (_, i) => updateJob(job.id, (j) => void (j.videos as unknown[]).push(i))));
const n = (await getJob(job.id))!.videos.length;
console.log(n === 50 ? "PASS" : "FAIL", n, "of 50");
await rm(jobDir(job.id), { recursive: true });
```

## Limits

- The queue only works inside one Node process. That's fine for one server today. With several servers, use a database transaction or file lock instead.
- The map keeps one settled promise per job id, which is a few bytes per job.
