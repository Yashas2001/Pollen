"use client";

import type { Job } from "@/lib/jobs";

// More channels (ads, email, creators, auto-post): the work is prepared, launching
// unlocks when they connect an account. "Connect" only logs interest. Never fake live.
// STUB: Teammate B replaces this.
export function EarlyAccess({ job }: { job: Job }) {
  void job;
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">More channels</h2>
      <p className="text-sm text-black/50">Early access</p>
    </section>
  );
}
