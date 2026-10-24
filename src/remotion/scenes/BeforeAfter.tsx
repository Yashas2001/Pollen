import React from "react";
import { Img } from "remotion";
import type { Asset } from "../schema";
import { WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { Abs } from "../fx";
import { clamp, expoInOut, expoOut, lerp, prog } from "../motion";

type Props = { f: number; dur: number; before: Asset; after: Asset; labels: string[]; theme: Theme };

// A wipe sweeps across: washed-out "before" on one side, the vivid "after" taking over.
export const BeforeAfterScene: React.FC<Props> = ({ f, dur, before, after, labels, theme }) => {
  const enter = prog(f, 0, 14, expoOut);
  const wipe = prog(f, dur * 0.3, Math.max(12, dur * 0.35), expoInOut);
  const out = prog(f, dur - 7, 7, (t) => t * t);
  const w = 880;
  const h = 1020;
  const left = (W - w) / 2;
  const top = 560;
  const split = lerp(0.92, 0.08, wipe); // fraction of the card still "before"
  const pos = (a: Asset): string => (a.kind === "image" ? "center" : "top");
  const tag = (text: string, on: number, side: "l" | "r", hot: boolean) => (
    <div
      style={{
        position: "absolute",
        top: 34,
        [side === "l" ? "left" : "right"]: 34,
        padding: "12px 26px",
        borderRadius: 999,
        background: hot ? theme.accent.main : "rgba(0,0,0,0.65)",
        color: hot ? theme.accent.onMain : "#fff",
        fontFamily: HEADLINE_FONT,
        fontWeight: 800,
        fontSize: 34,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        opacity: on,
      }}
    >
      {text}
    </div>
  );

  return (
    <Abs style={{ opacity: 1 - out }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          borderRadius: 48,
          overflow: "hidden",
          border: theme.dark ? `2px solid ${theme.accent.main}` : "12px solid #fff",
          boxShadow: theme.cardShadow,
          transform: `perspective(1800px) rotateY(${lerp(-12, -3, enter)}deg) scale(${lerp(0.9, 1, enter)})`,
          opacity: clamp(enter * 2),
        }}
      >
        <Img src={after.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos(after) }} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}>
          <Img
            src={before.url}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos(before), filter: "grayscale(0.9) brightness(0.65) contrast(0.9) blur(1.5px)" }}
          />
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${split * 100}%`, width: 6, marginLeft: -3, background: "#fff", boxShadow: `0 0 30px ${theme.accent.main}, 0 0 8px #fff` }} />
        {tag(labels[0] || "Before", clamp(1 - wipe * 1.4), "l", false)}
        {tag(labels[1] || "After", clamp(wipe * 1.4 - 0.2), "r", true)}
      </div>
    </Abs>
  );
};
