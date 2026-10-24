import { getUser, recordUser } from "@/lib/auth";
import { runAllowance } from "@/lib/limits";

// Called right after Google sign in: adds them to the users list.
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  await recordUser(user);
  return Response.json(user);
}

// Free runs left (null = no limit) and Pro waitlist status, shown before they start.
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  return Response.json(await runAllowance(user), { headers: { "Cache-Control": "no-store" } });
}
