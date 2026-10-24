import { getUser } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";

// "My products": this user's runs, newest first.
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const jobs = (await listJobs()).filter((j) => j.owner?.uid === user.uid);
  return Response.json(
    jobs.map((j) => ({ id: j.id, url: j.url, goal: j.goal, step: j.step, createdAt: j.createdAt })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
