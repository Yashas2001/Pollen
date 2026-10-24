import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Plus Jakarta Sans, the launch film's face. Loaded once; rendering waits for it.
export const HEADLINE_FONT = "'Jakarta', system-ui, sans-serif";
// Anton: the tall condensed face of the punch words in winning Shorts.
export const PUNCH_FONT = "'Anton', Impact, sans-serif";

let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!loading) {
    const face = new FontFace("Jakarta", `url(${staticFile("fonts/PlusJakartaSans.woff2")}) format('woff2')`, {
      weight: "200 800",
    });
    const punch = new FontFace("Anton", `url(${staticFile("fonts/Anton.woff2")}) format('woff2')`);
    loading = Promise.all([face.load(), punch.load()]).then((fs) => {
      fs.forEach((f) => document.fonts.add(f));
    });
  }
  return loading;
}

// Rendering waits for the font (same pattern as the launch film).
export function useFontsReady() {
  const [handle] = useState(() => (typeof document === "undefined" ? null : delayRender("fonts")));
  useEffect(() => {
    if (handle === null) return;
    loadFonts().then(() => continueRender(handle));
  }, [handle]);
}
