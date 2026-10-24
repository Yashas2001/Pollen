"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/firebase";

const GOALS = ["My first 50 users", "First 10 paying customers", "More signups", "Waitlist sign-ups", "More sales"];
const MAX_FILES = 10;

type Allowance = { left: number | null; freeRuns: number; onWaitlist: boolean };

// One question at a time: link -> what they need -> clips (optional) -> go.
export function LinkForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlBox = useRef<HTMLInputElement>(null);
  const goalBox = useRef<HTMLInputElement>(null);
  // Free runs left (null = no limit), so nobody fills all three steps for nothing.
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  useEffect(() => {
    authFetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAllowance)
      .catch(() => {});
  }, []);

  // Read the box itself, not typing events: autofill and text typed before the page
  // finished loading never fire them.
  function nextFromUrl(e: React.FormEvent) {
    e.preventDefault();
    const value = urlBox.current?.value.trim() ?? "";
    if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(value)) return setError("Paste your product's website link, like yourproduct.com");
    setUrl(value);
    setError(null);
    setStep(2);
  }

  function pickGoal(g: string) {
    if (!g.trim()) return setError("Pick one, or write what you need.");
    setGoal(g.trim());
    setError(null);
    setStep(3);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    // Clips are optional; with them the videos are built on real footage of you and the product.
    const body = new FormData();
    body.set("url", url);
    body.set("goal", goal);
    files.forEach((f) => body.append("files", f));
    const res = await authFetch("/api/jobs", { method: "POST", body }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { id?: string; error?: string }) : {};
    if (res?.status === 429) {
      // Used their last run in another tab meanwhile: show the same screen as on arrival.
      const fresh = (await authFetch("/api/me")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as Allowance | null;
      if (fresh?.left === 0) {
        setAllowance(fresh);
        setBusy(false);
        return;
      }
    }
    if (!res?.ok || !data.id) {
      setError(data.error ?? "Something went wrong. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/v/${data.id}`);
  }

  if (allowance?.left === 0) return <ProWaitlist allowance={allowance} />;

  return (
    <div className="flex w-full max-w-xl flex-col gap-5">
      <div className="relative flex h-6 items-center justify-center">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => (setError(null), setStep((s) => (s - 1) as 1 | 2))}
            className="absolute left-0 text-sm font-semibold text-black/50"
          >
            ← Back
          </button>
        ) : null}
        <span className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-1.5 w-6 rounded-full ${n <= step ? "bg-black" : "bg-black/15"}`} />
          ))}
        </span>
      </div>

      {step === 1 ? (
        <form onSubmit={nextFromUrl} className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What&apos;s your product&apos;s link?</h1>
            <p className="mt-2 text-black/50">Your website or app page. We&apos;ll read it to get to know your product.</p>
          </div>
          <input
            ref={urlBox}
            defaultValue={url}
            autoFocus
            placeholder="yourproduct.com"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            className="h-14 rounded-2xl border border-black/10 bg-white px-5 text-lg text-black outline-none focus:border-black/40"
          />
          <p className="-mt-2 text-sm text-black/40">e.g. cal.com · linear.app · notion.so</p>
          {allowance?.left ? (
            <p className="-mt-2 text-sm text-black/40">{allowance.left === 1 ? "1 free run left." : `${allowance.left} free runs left.`}</p>
          ) : null}
          <button type="submit" className="h-14 rounded-2xl bg-black text-lg font-semibold text-white">
            Next
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pickGoal(goalBox.current?.value ?? "");
          }}
          className="flex flex-col gap-4"
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What do you need?</h1>
          <p className="-mt-2 text-black/50">{url.replace(/^https?:\/\//, "")}</p>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => pickGoal(g)}
                className={`h-14 rounded-2xl px-5 text-left text-lg font-semibold ${
                  goal === g ? "bg-black text-white" : "border border-black/10 bg-white text-black hover:border-black/40"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={goalBox}
              defaultValue={GOALS.includes(goal) ? "" : goal}
              placeholder="Something else"
              className="h-14 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-5 text-lg text-black outline-none focus:border-black/40"
            />
            <button type="submit" className="h-14 rounded-2xl bg-black px-6 font-semibold text-white">
              Next
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Got any clips or photos?</h1>
          <p className="-mt-2 text-black/50">Optional, but the videos get far better with them.</p>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-black/25 bg-white px-5 py-8 text-center hover:border-black/50">
            <span className="text-lg font-semibold">{files.length ? "Add more" : "Choose files"}</span>
            <span className="text-sm text-black/55">
              A clip of you talking about it, screen recordings, product photos, past videos. Up to {MAX_FILES}.
            </span>
            <input
              type="file"
              accept="video/*,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.size > 0);
                setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES));
                e.target.value = "";
              }}
            />
          </label>
          {files.length ? (
            <ul className="flex flex-col gap-2 text-left">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))} className="shrink-0 font-semibold text-black/50">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-black/45">Got nothing? Film 30 seconds on your phone: who it&apos;s for, what it does, why you built it.</p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="h-14 rounded-2xl bg-black text-lg font-semibold text-white disabled:opacity-60"
          >
            {busy ? (files.length ? "Uploading..." : "Starting...") : "Get me customers"}
          </button>
          {!files.length ? <p className="-mt-2 text-sm text-black/45">No files? That&apos;s fine, we&apos;ll use your website.</p> : null}
          {allowance?.left ? (
            <p className="-mt-2 text-sm text-black/45">{allowance.left === 1 ? "This is your last free run." : `You have ${allowance.left} free runs.`}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}

// Out of free runs: Pro is coming, and joining the waitlist is our demand proof.
function ProWaitlist({ allowance }: { allowance: Allowance }) {
  const [joined, setJoined] = useState(allowance.onWaitlist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await authFetch("/api/me/pro", { method: "POST" }).catch(() => null);
    if (res?.ok) setJoined(true);
    else setError("That didn't go through. Try again.");
    setBusy(false);
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">You&apos;ve used your {allowance.freeRuns} free runs</h1>
        <p className="mt-2 text-lg text-black/60">
          Pollen Pro is coming soon: more products, and fresh videos and people to reach every week.
        </p>
      </div>
      {joined ? (
        <p className="flex h-14 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-black">
          You&apos;re on the list. We&apos;ll email you when Pro opens.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void join()}
          disabled={busy}
          className="h-14 rounded-2xl bg-black text-lg font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Joining..." : "Join the Pro waitlist"}
        </button>
      )}
      {error ? <p className="text-red-600">{error}</p> : null}
      <p className="text-sm text-black/45">Your products below are still yours to open and use.</p>
    </div>
  );
}
