import { accentFor } from "./motion";

// Two looks. "dark": the launch film's stage. "light": airy and soft, like the
// CapCut product ads (blurred product backdrop, white cards, dark type).
export type Theme = {
  dark: boolean;
  bg: string;
  fg: string;
  sub: string;
  card: string;
  cardBorder: string;
  cardShadow: string;
  textShadow: string;
  accent: { main: string; light: string; deep: string; ink: string; onMain: string };
  gradient: [string, string];
};

export function themeFor(name: "dark" | "light", brandPrimary: string): Theme {
  const accent = accentFor(brandPrimary);
  if (name === "light") {
    return {
      dark: false,
      bg: "#F3F0EA",
      fg: "#111116",
      sub: "rgba(17,17,22,0.55)",
      card: "#FFFFFF",
      cardBorder: "rgba(17,17,22,0.06)",
      cardShadow: "0 50px 100px -30px rgba(30,30,60,0.45), 0 10px 30px rgba(30,30,60,0.12)",
      textShadow: "0 2px 20px rgba(255,255,255,0.6)",
      accent,
      // very bright hues (lime, yellow) stay unreadable even at "deep"; use ink for both ends
      gradient: [accent.ink, accent.onMain === "#FFFFFF" ? accent.deep : accent.ink],
    };
  }
  return {
    dark: true,
    bg: "#050409",
    fg: "#FFFFFF",
    sub: "rgba(255,255,255,0.6)",
    card: "#0E0F17",
    cardBorder: accent.main,
    cardShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 60px 120px -20px rgba(0,0,0,0.95), 0 0 90px -10px ${accent.main}`,
    textShadow: "0 6px 30px rgba(0,0,0,0.6)",
    accent,
    gradient: [accent.light, accent.main],
  };
}
