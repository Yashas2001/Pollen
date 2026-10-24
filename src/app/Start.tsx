"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, signInWithGoogle, signOutUser, useUser } from "@/lib/firebase";
import { LinkForm } from "./LinkForm";

type MyJob = { id: string; url: string; goal: string; step: string; createdAt: string };

// The app on /app (signed in only): the link box and their past runs.
export function Start() {
  const router = useRouter();
  const user = useUser();
  const [jobs, setJobs] = useState<MyJob[]>([]);

  // Signed out (or just signed out): the landing page is their front door.
  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/me/jobs")
      .then((r) => (r.ok ? (r.json() as Promise<MyJob[]>) : []))
      .then(setJobs)
      .catch(() => {});
  }, [user]);

  if (!user) return <div className="h-14" />;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between gap-3 text-sm text-black/60">
        <span className="flex min-w-0 items-center gap-2">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          ) : null}
          <span className="truncate">{user.displayName ?? user.email}</span>
        </span>
        <button onClick={() => void signOutUser()} className="shrink-0 font-semibold text-black/50 underline">
          Sign out
        </button>
      </div>
      <LinkForm />
      {jobs.length ? (
        <div className="w-full text-left">
          <p className="mb-2 text-sm font-semibold text-black/50">Your products</p>
          <div className="flex flex-col gap-2">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/v/${j.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <span className="min-w-0 truncate font-semibold">{j.url.replace(/^https?:\/\//, "")}</span>
                <span className="shrink-0 text-sm text-black/50">{j.goal}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Signed in: straight to the app. Signed out: Google first, then the app.
export function StartButton() {
  const router = useRouter();
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in: the landing page has nothing for them, open the app.
  useEffect(() => {
    if (user) router.replace("/app");
  }, [user, router]);

  async function start() {
    setError(null);
    if (user) return router.push("/app");
    setBusy(true);
    try {
      await signInWithGoogle();
      router.push("/app");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError("Sign in didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => void start()}
        disabled={busy}
        className="h-14 rounded-2xl bg-black px-10 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Signing in..." : "Start free"}
      </button>
      <p className="text-sm text-black/50">Sign in with Google. Takes one tap.</p>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
