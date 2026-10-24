"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GOALS = ["My first 50 users", "First 10 paying customers", "More signups", "Waitlist sign-ups", "More sales"];

export function LinkForm() {
  const router = useRouter();
  const [goal, setGoal] = useState(GOALS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the boxes from the form itself, not from typing events: autofill and text typed
  // before the page finished loading never fire them, and the button must still work.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    if (!url) return setError("Paste your product's website link.");
    setBusy(true);
    setError(null);
    // Clips are optional; with them the videos are built on real footage of you and the product.
    const body = new FormData();
    body.set("url", url);
    body.set("goal", String(form.get("goal") ?? "").trim());
    form.getAll("files").forEach((f) => f instanceof File && f.size && body.append("files", f));
    const res = await fetch("/api/jobs", { method: "POST", body });
    const data = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? "Something went wrong. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/v/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl flex-col gap-3">
      <input
        name="url"
        placeholder="yourproduct.com"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        className="h-14 rounded-2xl border border-black/10 bg-white px-5 text-lg text-black outline-none focus:border-black/40"
      />
      <p className="mt-2 text-left text-sm font-semibold text-black/50">What do you need?</p>
      <div className="flex flex-wrap gap-2">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              goal === g ? "bg-black text-white" : "border border-black/15 bg-white text-black"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <input
        name="goal"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Or write your own"
        className="h-12 rounded-2xl border border-black/10 bg-white px-5 text-black outline-none focus:border-black/40"
      />
      <label className="mt-2 flex cursor-pointer flex-col gap-1 rounded-2xl border border-dashed border-black/20 bg-white px-5 py-4 text-left">
        <span className="font-semibold text-black">Add anything you have (optional, makes the videos far better)</span>
        <span className="text-sm text-black/55">
          A clip of you talking about it, screen recordings, product photos, past videos. Up to 10. Got nothing? Film 30 seconds on your phone: who it&apos;s for, what it does, why you built it.
        </span>
        <input name="files" type="file" accept="video/*,image/*" multiple className="mt-1 text-sm text-black/70" />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="mt-2 h-14 rounded-2xl bg-black px-7 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Uploading..." : "Get me customers"}
      </button>
      {error ? <p className="text-red-600">{error}</p> : null}
    </form>
  );
}
