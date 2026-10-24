import { createRemoteJWKSet, jwtVerify } from "jose";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Checks a Firebase ID token with Google's public keys (no service account needed)
// and keeps a list of everyone who signed in: data/users.json.

export type AuthUser = { uid: string; email: string; name: string; picture: string | null };
export type UserRecord = AuthUser & { firstSeen: string; lastSeen: string };

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export async function getUser(request: Request): Promise<AuthUser | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, KEYS, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT });
    if (!payload.sub) return null;
    return {
      uid: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? payload.email ?? "Someone"),
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

export const isAdmin = (user: AuthUser | null) =>
  !!user?.email &&
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(user.email.toLowerCase());

export async function readUsers(): Promise<Record<string, UserRecord>> {
  try {
    return JSON.parse(await readFile(USERS_FILE, "utf8")) as Record<string, UserRecord>;
  } catch {
    return {};
  }
}

// One write at a time (on globalThis because Next can load this module once per route).
const g = globalThis as { __usersQueue?: Promise<unknown> };

export function recordUser(user: AuthUser): Promise<void> {
  const run = (g.__usersQueue ?? Promise.resolve()).then(async () => {
    const users = await readUsers();
    const now = new Date().toISOString();
    users[user.uid] = { ...user, firstSeen: users[user.uid]?.firstSeen ?? now, lastSeen: now };
    await mkdir(path.dirname(USERS_FILE), { recursive: true });
    const tmp = `${USERS_FILE}.${randomUUID().slice(0, 6)}.tmp`;
    await writeFile(tmp, JSON.stringify(users, null, 2));
    await rename(tmp, USERS_FILE);
  });
  g.__usersQueue = run.catch(() => {});
  return run;
}
