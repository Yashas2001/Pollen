import { Start } from "../Start";

export const metadata = { title: "Pollen" };

// The app: link + goal (+ optional clips), and your past runs. Needs Google sign in.
export default function AppPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center bg-[#F6F4EF] px-4 text-center text-black">
      <Start />
    </main>
  );
}
