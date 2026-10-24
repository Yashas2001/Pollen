import { getUser } from "@/lib/auth";
import { joinProWaitlist, runAllowance } from "@/lib/limits";

// "Join the Pro waitlist": logs who wants more than the free runs. Nothing is charged.
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!(await runAllowance(user)).onWaitlist) await joinProWaitlist(user);
  return Response.json({ ok: true });
}
