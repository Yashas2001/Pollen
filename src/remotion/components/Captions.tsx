import React, { useMemo } from "react";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../schema";
import { HEADLINE_FONT } from "../fonts";
import { backOut, prog } from "../motion";

// Captions set like the film's: bold white words, the one being spoken boxed in
// the brand colour, each page popping in.
export const Captions: React.FC<{ captions: Caption[]; accent: string; onAccent?: string }> = ({ captions, accent, onAccent = "#fff" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const pages = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 700 }).pages,
    [captions],
  );
  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs);
  if (!page) return null;
  const pageFrame = (page.startMs / 1000) * fps;
  const pop = prog(frame, pageFrame, 8, (t) => backOut(t, 2.2));

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 250,
        padding: "18px 22px",
        borderRadius: 36,
        background: "rgba(5,4,9,0.62)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 4px",
        fontFamily: HEADLINE_FONT,
        fontWeight: 800,
        fontSize: 66,
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
        transform: `scale(${0.9 + 0.1 * pop})`,
        opacity: Math.min(1, pop * 2),
      }}
    >
      {page.tokens.map((t, i) => {
        const active = nowMs >= t.fromMs && nowMs < t.toMs;
        return (
          <span
            key={i}
            style={{
              padding: "0 0.16em",
              borderRadius: 14,
              color: active ? onAccent : "#fff",
              background: active ? accent : "transparent",
              boxShadow: active ? `0 0 30px ${accent}` : "none",
              textShadow: active ? "none" : "0 0 18px rgba(0,0,0,0.95), 0 4px 16px rgba(0,0,0,0.95)",
            }}
          >
            {t.text.trim()}
          </span>
        );
      })}
    </div>
  );
};
