import React from "react";
import { HEADLINE_FONT } from "../fonts";
import { clamp, expoIn, expoOut, lerp, prog } from "../motion";
import { BEAT_MS } from "../score";
import { FPS } from "../schema";

const BEAT_FRAMES = (BEAT_MS / 1000) * FPS;

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

type Props = {
  f: number; // local frame
  dur: number; // shot length in frames, for the exit
  text: string;
  highlight: string;
  gradient: [string, string];
  size: number;
  align?: "center" | "left";
  // "rise": letters climb out of a mask (the film's op labels).
  // "slam": lands in one hit, a little too big, speed still on it.
  // "blur": words sharpen into place.
  // "beats": one word slams in per beat (the hook, on the drop).
  kind?: "rise" | "slam" | "blur" | "beats";
  delay?: number;
  color?: string;
  shadow?: string;
};

// Kinetic type in the launch film's style: Jakarta 800, tight tracking,
// the key word in the brand gradient, everything enters and exits on purpose.
export const Title: React.FC<Props> = ({
  f,
  dur,
  text,
  highlight,
  gradient,
  size,
  align = "center",
  kind = "rise",
  delay = 0,
  color = "#fff",
  shadow = "0 6px 30px rgba(0,0,0,0.6)",
}) => {
  const words = text.split(/\s+/).filter(Boolean);
  const hl = clean(highlight);
  const out = prog(f, dur - 8, 8, expoIn);
  const slam = prog(f, delay, 12, expoOut);

  let charIndex = 0;
  return (
    <div
      style={{
        fontFamily: HEADLINE_FONT,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: "-0.045em",
        color,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: `0 ${size * 0.24}px`,
        textAlign: align,
        textShadow: shadow,
        transform: kind === "slam" ? `scale(${lerp(1.45, 1, slam) * (1 - 0.08 * out)})` : undefined,
        opacity: kind === "slam" ? clamp(slam * 4) * (1 - out) : 1,
        filter: kind === "slam" ? `blur(${(1 - slam) * 12}px)` : undefined,
      }}
    >
      {words.map((w, wi) => {
        const isHl = hl.length > 0 && clean(w) === hl;
        const style: React.CSSProperties = isHl
          ? {
              background: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "none",
              filter: `drop-shadow(0 0 24px ${gradient[1]}88)`,
            }
          : {};

        if (kind === "beats") {
          const at = delay + wi * BEAT_FRAMES;
          const p = prog(f, at, 9, expoOut);
          const po = prog(f, dur - 8, 8, expoIn);
          return (
            <span
              key={wi}
              style={{
                display: "inline-block",
                transform: `scale(${lerp(1.6, 1, p) * (1 - 0.06 * po)})`,
                opacity: clamp(p * 4) * (1 - po),
                filter: `blur(${(1 - p) * 14 + po * 10}px)`,
                ...style,
              }}
            >
              {w}
            </span>
          );
        }

        if (kind === "blur") {
          const p = prog(f, delay + wi * 3, 14, expoOut);
          const po = prog(f, dur - 8 + wi, 8, expoIn);
          return (
            <span
              key={wi}
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 50 - po * 30}px)`,
                opacity: p * (1 - po),
                filter: `blur(${(1 - p) * 10 + po * 8}px)`,
                ...style,
              }}
            >
              {w}
            </span>
          );
        }

        if (kind === "slam") {
          return (
            <span key={wi} style={{ display: "inline-block", ...style }}>
              {w}
            </span>
          );
        }

        // rise: each letter climbs out of its own mask
        return (
          <span key={wi} style={{ display: "inline-flex", whiteSpace: "pre" }}>
            {w.split("").map((ch) => {
              const i = charIndex++;
              const pin = prog(f, delay + i * 0.7, 13, expoOut);
              const pout = prog(f, dur - 9 + i * 0.25, 9, expoIn);
              return (
                <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.06em 0 0.14em", margin: "-0.06em 0 -0.14em" }}>
                  <span
                    style={{
                      display: "inline-block",
                      transform: `translateY(${(1 - pin) * 105 + pout * 105}%)`,
                      ...style,
                    }}
                  >
                    {ch}
                  </span>
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};
