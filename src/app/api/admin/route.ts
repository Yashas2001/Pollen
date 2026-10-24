import { getUser, isAdmin, readUsers } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";
import { getStats } from "@/lib/links";
import { readLimitHits } from "@/lib/limits";

// The users proof: everyone who signed in, what they ran, and the clicks it brought them.
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!isAdmin(user)) return Response.json({ error: "Admins only" }, { status: 403 });

  const [users, jobs, hits] = await Promise.all([readUsers(), listJobs(), readLimitHits()]);
  const clicks = new Map(await Promise.all(jobs.map(async (j) => [j.id, (await getStats(j.id)).totalClicks] as const)));

  const rows = Object.values(users)
    .map((u) => {
      const mine = jobs.filter((j) => j.owner?.uid === u.uid);
      return {
        name: u.name,
        email: u.email,
        picture: u.picture,
        firstSeen: u.firstSeen,
        products: mine.map((j) => ({ id: j.id, url: j.url, step: j.step, clicks: clicks.get(j.id) ?? 0 })),
        clicks: mine.reduce((n, j) => n + (clicks.get(j.id) ?? 0), 0),
      };
    })
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));

  return Response.json(
    {
      signedUp: rows.length,
      usedIt: rows.filter((r) => r.products.length).length,
      gotClicks: rows.filter((r) => r.clicks > 0).length,
      // Wanted another run after the limit: demand proof.
      wantedMore: hits.length,
      wantedMoreEmails: hits.map((h) => `${h.email} (${h.reason === "used" ? "used their free runs" : "day was full"})`),
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
