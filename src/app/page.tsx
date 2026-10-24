import { LinkForm } from "./LinkForm";

// Landing page and app entry in one: the link box is the product.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#F6F4EF] px-4 py-16 text-center text-black">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/40">Pollen</p>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Tell it you need customers.</h1>
      <p className="max-w-xl text-lg text-black/60">
        It shows what&apos;s working in your market, makes your version, finds the people who want your product right
        now, and shows you who clicked.
      </p>
      <LinkForm />
      <p className="text-sm font-semibold text-black/40">Customers, not marketing advice.</p>
    </main>
  );
}
