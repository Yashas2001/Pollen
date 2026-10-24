"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? "Something went wrong. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/v/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="yourproduct.com"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        className="h-14 flex-1 rounded-2xl border border-black/10 bg-white px-5 text-lg text-black outline-none focus:border-black/40"
      />
      <button
        disabled={busy || !url.trim()}
        className="h-14 rounded-2xl bg-black px-7 text-lg font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Starting..." : "Make my posts"}
      </button>
      {error ? <p className="text-red-600 sm:basis-full">{error}</p> : null}
    </form>
  );
}
