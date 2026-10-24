import { getUser, recordUser } from "@/lib/auth";

// Called right after Google sign in: adds them to the users list.
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  await recordUser(user);
  return Response.json(user);
}
