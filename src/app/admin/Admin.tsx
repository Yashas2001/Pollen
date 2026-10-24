"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch, signInWithGoogle, useUser } from "@/lib/firebase";

type Data = {
  signedUp: number;
  usedIt: number;
  gotClicks: number;
  rows: {
    name: string;
    email: string;
    picture: string | null;
    firstSeen: string;
    products: { id: string; url: string; step: string; clicks: number }[];
    clicks: number;
  }[];
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Live users list for the judges: refreshes every 15 s.
export function Admin() {
  const user = useUser();
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      authFetch("/api/admin", { cache: "no-store" })
        .then(async (r) => (r.status === 403 ? setDenied(true) : r.ok && setData((await r.json()) as Data)))
        .catch(() => {});
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [user]);

  if (user === undefined) return null;
  if (!user)
    return (
      <button onClick={() => void signInWithGoogle()} className="rounded-2xl bg-black px-6 py-3 font-semibold text-white">
        Sign in
      </button>
    );
  if (denied) return <p className="text-black/60">This page is for the Pollen team.</p>;
  if (!data) return <p className="text-black/50">Loading...</p>;

  return (
    <div className="w-full max-w-5xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/40">Pollen · live</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat n={data.signedUp} label="Signed up" />
        <Stat n={data.usedIt} label="Ran it on their product" />
        <Stat n={data.gotClicks} label="Got clicks from it" />
      </div>
      <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-black/40">
            <tr>
              <th className="p-4">Who</th>
              <th className="p-4">Joined</th>
              <th className="p-4">Product</th>
              <th className="p-4 text-right">Clicks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {data.rows.map((r) => (
              <tr key={r.email + r.firstSeen}>
                <td className="p-4">
                  <span className="flex items-center gap-2">
                    {r.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                    ) : null}
                    <span>
                      <span className="block font-semibold">{r.name}</span>
                      <span className="block text-black/50">{r.email}</span>
                    </span>
                  </span>
                </td>
                <td className="p-4 text-black/60">{time(r.firstSeen)}</td>
                <td className="p-4">
                  {r.products.length
                    ? r.products.map((p) => (
                        <Link key={p.id} href={`/v/${p.id}`} className="block font-semibold underline">
                          {p.url.replace(/^https?:\/\//, "")}
                        </Link>
                      ))
                    : <span className="text-black/40">not yet</span>}
                </td>
                <td className="p-4 text-right text-lg font-black tabular-nums">{r.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-5xl font-black tabular-nums">{n}</p>
      <p className="mt-1 text-sm text-black/50">{label}</p>
    </div>
  );
}
