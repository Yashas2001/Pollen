"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, signInWithGoogle, signOutUser, useUser } from "@/lib/firebase";
import { LinkForm } from "./LinkForm";

type MyJob = { id: string; url: string; goal: string; step: string; createdAt: string };

// The app on /app: sign in if needed, then the link box and their past runs.
export function Start() {
  const user = useUser();
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<MyJob[]>([]);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/me/jobs")
      .then((r) => (r.ok ? (r.json() as Promise<MyJob[]>) : []))
      .then(setJobs)
      .catch(() => {});
  }, [user]);

  if (user === undefined) return <div className="h-14" />;

  if (!user) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        <button
          onClick={() => {
            setError(null);
            signInWithGoogle().catch((e: { code?: string }) => {
              if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request")
                setError("Sign in didn't work. Try again.");
            });
          }}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-black px-7 text-lg font-semibold text-white"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="text-sm text-black/50">Sign in to start. Free.</p>
        {error ? <p className="text-red-600">{error}</p> : null}
      </div>
    );
  }

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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
