import { getUser, isAdmin, readUsers } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";
import { getStats } from "@/lib/links";
import { readLimitHits, readProWaitlist } from "@/lib/limits";

// Adult sites, matched on the host name. Anyone who ran one still counts in the totals (they did
// try it), but their row, products and email never reach this page, so it can be shown in a demo.
const UNWANTED = /porn|xxx|xvideos|xnxx|xhamster|redtube|onlyfans|brazzers|chaturbate|stripchat|livejasmin|spankbang|hentai|nsfw|erome|fansly/i;
const unwanted = (url: string) => {
  try {
    return UNWANTED.test(new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname);
  } catch {
    return UNWANTED.test(url);
  }
};

// The users proof: everyone who signed in, what they ran, and the clicks it brought them.
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!isAdmin(user)) return Response.json({ error: "Admins only" }, { status: 403 });

  const [users, jobs, hits, pro] = await Promise.all([readUsers(), listJobs(), readLimitHits(), readProWaitlist()]);
  const hidden = new Set(jobs.flatMap((j) => (unwanted(j.url) && j.owner ? [j.owner.uid] : [])));
  const hiddenEmails = new Set(Object.values(users).filter((u) => hidden.has(u.uid)).map((u) => u.email));
  const clicks = new Map(await Promise.all(jobs.map(async (j) => [j.id, (await getStats(j.id)).totalClicks] as const)));

  const everyone = Object.values(users)
    .map((u) => {
      const mine = jobs.filter((j) => j.owner?.uid === u.uid);
      return {
        uid: u.uid,
        name: u.name,
        email: u.email,
        picture: u.picture,
        firstSeen: u.firstSeen,
        products: mine.map((j) => ({ id: j.id, url: j.url, step: j.step, clicks: clicks.get(j.id) ?? 0 })),
        clicks: mine.reduce((n, j) => n + (clicks.get(j.id) ?? 0), 0),
      };
    })
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  const rows = everyone.filter((r) => !hidden.has(r.uid)).map(({ uid, ...r }) => (void uid, r));

  return Response.json(
    {
      // Totals count everyone, hidden people included.
      signedUp: everyone.length,
      usedIt: everyone.filter((r) => r.products.length).length,
      gotClicks: everyone.filter((r) => r.clicks > 0).length,
      // Wanted another run after the limit: demand proof.
      wantedMore: hits.length,
      wantedMoreEmails: hits.map((h) => h.email).filter((e) => !hiddenEmails.has(e)),
      proWaitlist: pro.length,
      proWaitlistEmails: pro.map((p) => p.email).filter((e) => !hiddenEmails.has(e)),
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
