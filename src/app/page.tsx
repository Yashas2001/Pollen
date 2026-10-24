import { LinkForm } from "./LinkForm";

// Landing page and app entry in one: the link box is the product.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#F6F4EF] px-4 py-16 text-center text-black">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        Marketing videos for your product. Every week.
      </h1>
      <p className="max-w-xl text-lg text-black/60">
        Paste your website. Get TikToks, Reels and Shorts in formats that already work, made from your real product.
        Ready to post.
      </p>
      <LinkForm />
    </main>
  );
}
