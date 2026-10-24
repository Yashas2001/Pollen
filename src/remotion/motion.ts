// Motion helpers, same feel as the launch film (cubix-showreel/src/lib.ts).
import { FPS } from "./schema";
import { KICKS_MS } from "./score";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const expoIn = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const expoInOut = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
export const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const sineIO = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const backOut = (t: number, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/** progress of frame f across [start, start+dur], eased */
export const prog = (f: number, start: number, dur: number, ease: (t: number) => number = (t) => t) =>
  ease(clamp((f - start) / dur));

export const msToFrames = (ms: number) => Math.round((ms / 1000) * FPS);
export const KICK_FRAMES = KICKS_MS.map(msToFrames);

/** decaying pulse after each kick (absolute frames) */
export const kickEnv = (f: number, tau = 5) => {
  let v = 0;
  for (const k of KICK_FRAMES) {
    if (k > f) break;
    v = Math.max(v, Math.exp(-(f - k) / tau));
  }
  return v;
};

/** pulse at specific frames */
export const hitEnv = (f: number, hits: number[], tau = 6) => {
  let v = 0;
  for (const h of hits) if (f >= h) v = Math.max(v, Math.exp(-(f - h) / tau));
  return v;
};

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const fr = x - i;
  const a = hash(i + seed * 101.3);
  const b = hash(i + 1 + seed * 101.3);
  const u = fr * fr * (3 - 2 * fr);
  return lerp(a, b, u) * 2 - 1;
};

// ---------------------------------------------------------------- colour
// Brand colours come from any website. On the dark stage the accent must glow,
// so it is pushed to a vivid, light-enough version of itself.
function hexToHsl(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const c = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${c(0)}${c(8)}${c(4)}`;
}

// Hex out, so callers can append alpha ("#rrggbb" + "aa").
export function accentFor(hex: string): { main: string; light: string; deep: string; ink: string; onMain: string } {
  const hsl = hexToHsl(hex);
  // Greys and missing colours fall back to the film's violet.
  const [h, s0] = hsl && hsl[1] > 0.18 ? hsl : [256, 0.9, 0.6];
  const s = Math.max(s0, 0.7);
  // ink: dark enough to read on a light background. onMain: text colour on top of main.
  const yellowGreen = h > 45 && h < 170; // these hues stay bright even at mid lightness
  return {
    main: hslToHex(h, s, 0.64),
    light: hslToHex(h, s, 0.82),
    deep: hslToHex(h, s, 0.46),
    ink: hslToHex(h, s, yellowGreen ? 0.26 : 0.36),
    onMain: yellowGreen ? "#0B0B0F" : "#FFFFFF",
  };
}
