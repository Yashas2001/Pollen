"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";

// Google sign-in (Firebase project pollen-5761b). The server checks the ID token
// on every call that needs a user: see src/lib/auth.ts.
const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
export const auth = getAuth(app);

export async function signInWithGoogle() {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  // Records the user (our "20 users" list) on first sign in.
  await authFetch("/api/me", { method: "POST" }).catch(() => {});
  return user;
}

export const signOutUser = () => signOut(auth);

// undefined = still checking, null = signed out.
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export async function authFetch(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
