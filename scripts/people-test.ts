import { findPeople } from "@/lib/people";

const BRIEFS = {
  "cubix.design": { url: "https://cubix.design", what: "AI video editor: upload footage, tell it what you want, it edits", who: "creators, founders and small brands making short videos", pain: "editing takes hours and needs skills", niche: "AI video editing tools", audience: "content creators", competitors: ["CapCut", "Descript", "Opus Clip"] },
  "cal.com": { url: "https://cal.com", what: "open source scheduling, booking links for meetings", who: "freelancers, teams, founders", pain: "back-and-forth emails to find a meeting time", niche: "scheduling software", audience: "professionals who book meetings", competitors: ["Calendly", "SavvyCal"] },
  "bakery": { url: "https://example-bakery.com", what: "a small bakery in Indiranagar selling sourdough", who: "people in Indiranagar", pain: "no good sourdough nearby", niche: "local bakery", audience: "locals", competitors: [] },
};

async function main() {
  const key = (process.argv[2] ?? "cubix.design") as keyof typeof BRIEFS;
  const t = Date.now();
  const people = await findPeople("test", { ...BRIEFS[key] });
  console.log(JSON.stringify(people, null, 2));
  console.log(`${people.length} people in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
void main();
