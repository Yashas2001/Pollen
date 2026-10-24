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

  if (!user) return <div className="flex-1" />;

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <header className="flex w-full max-w-5xl items-center justify-between gap-3 py-5 text-sm">
        <Link href="/app" className="font-bold uppercase tracking-[0.2em] text-black/40">
          Pollen
        </Link>
        <span className="flex min-w-0 items-center gap-3 text-black/60">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          ) : null}
          <span className="hidden truncate sm:inline">{user.displayName ?? user.email}</span>
          <button onClick={() => void signOutUser()} className="shrink-0 font-semibold text-black/50 underline">
            Sign out
          </button>
        </span>
      </header>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-10 pb-16">
        <LinkForm />
        {jobs.length ? (
          <div className="w-full max-w-xl text-left">
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
    </div>
  );
}

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
    <div className="flex flex-col items-center gap-2.5">
      <button
        onClick={() => void start()}
        disabled={busy}
        className="group relative inline-flex items-center justify-center gap-2 h-14 rounded-2xl bg-black px-10 text-lg font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.14)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        <span>{busy ? "Signing in..." : "Start free"}</span>
        {!busy && (
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 font-mono text-sm opacity-70">
            →
          </span>
        )}
      </button>
      <p className="text-sm font-medium text-black/50">Sign in with Google. Takes one tap.</p>
      {error ? <p className="text-sm font-medium text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
