"use client";

// Clicks per post and per channel, live. Fetch your own stats route and poll it.
// STUB: Teammate B replaces this.
export function Scoreboard({ jobId }: { jobId: string }) {
  void jobId;
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Scoreboard</h2>
      <p className="text-sm text-black/50">Clicks from every post show up here.</p>
    </section>
  );
}
