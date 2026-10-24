import { StartButton } from "./Start";

const STEPS = [
  { n: "1", title: "See what's working", text: "Your competitors' videos that beat their usual views, and why." },
  { n: "2", title: "Get your version", text: "Short videos in those formats, made from your real product." },
  { n: "3", title: "Find people asking", text: "Real posts from people who want what you built, with a reply ready." },
  { n: "4", title: "See who clicked", text: "Every post and reply gets its own link. Clicks show up live." },
];

// Small landing page. Start -> Google sign in -> the app (/app).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center bg-[#F6F4EF] px-4 text-black">
      <section className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-7 py-20 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/40">Pollen</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Tell it you need customers.</h1>
        <p className="max-w-xl text-lg text-black/60">
          It shows what&apos;s working in your market, makes your version, finds the people who want your product right
          now, and shows you who clicked.
        </p>
        <StartButton />
        <p className="text-sm font-semibold text-black/40">Customers, not marketing advice.</p>
      </section>
      <section className="grid w-full max-w-5xl gap-3 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-3xl bg-white p-5 text-left shadow-sm">
            <p className="text-sm font-black text-black/30">{s.n}</p>
            <p className="mt-1 font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-black/60">{s.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
