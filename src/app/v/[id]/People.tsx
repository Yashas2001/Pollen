"use client";

import type { Job } from "@/lib/jobs";

// People asking for this product right now, with a reply ready for each.
// STUB: Teammate A replaces this. Data is job.people (job.peopleStatus while it runs).
export function People({ job }: { job: Job }) {
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">People asking for this right now</h2>
      <p className="text-sm text-black/50">
        {job.peopleStatus === "finding" ? "Looking..." : `${job.people?.length ?? 0} found`}
      </p>
    </section>
  );
}
