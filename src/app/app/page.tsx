import Link from "next/link";
import { Start } from "../Start";

export const metadata = { title: "Pollen" };

// The app: link + goal (+ optional clips), and your past runs. Needs Google sign in.
export default function AppPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 bg-[#F6F4EF] px-4 py-12 text-center text-black">
      <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-black/40">
        Pollen
      </Link>
      <Start />
    </main>
  );
}
