import { findPeople } from "@/lib/people";

// One-off: people finder for a shop product (Bellroy wallets), to check shopper phrasing works.
async function main() {
  const t = Date.now();
  const people = await findPeople("test", {
    url: "https://bellroy.com",
    what: "Slim leather wallets, bags and phone cases",
    who: "People who want a thinner, well-made everyday wallet or bag",
    pain: "Bulky wallets and bags that wear out fast",
    niche: "Slim wallets and everyday carry",
    audience: "Everyday carry and buy-it-for-life shoppers",
    competitors: ["Ridge", "Secrid", "Ekster"],
  });
  for (const p of people) console.log(p.platform, p.score, p.url, "|", p.why, p.coach ? `| coach: ${p.coach.verdict}` : "");
  console.log(`${people.length} people in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
void main();
