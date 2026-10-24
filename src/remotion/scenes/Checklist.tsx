import React from "react";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { Abs } from "../fx";
import { BEAT_MS } from "../score";
import { FPS } from "../schema";
import { clamp, expoIn, expoOut, lerp, prog } from "../motion";
import { Check } from "./common";

const BEAT_FRAMES = (BEAT_MS / 1000) * FPS;

// Features slam in one per beat, each check drawn on.
export const ChecklistScene: React.FC<{ f: number; dur: number; items: string[]; theme: Theme }> = ({ f, dur, items, theme }) => {
  const list = items.slice(0, 5);
  const step = Math.min(BEAT_FRAMES, Math.max(6, (dur - 16) / Math.max(1, list.length)));
  return (
    <Abs style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "520px 110px 380px" }}>
      {list.map((item, i) => {
        const at = 4 + i * step;
        const p = prog(f, at, 10, expoOut);
        const po = prog(f, dur - 8 + i, 8, expoIn);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 30,
              padding: "26px 34px",
              borderRadius: 34,
              background: theme.dark ? "rgba(255,255,255,0.06)" : "#fff",
              border: theme.dark ? `1.5px solid ${theme.accent.main}55` : "1px solid rgba(0,0,0,0.05)",
              boxShadow: theme.dark ? `0 0 40px -10px ${theme.accent.main}` : "0 20px 50px -20px rgba(30,30,60,0.35)",
              transform: `translateX(${(1 - p) * (i % 2 ? 120 : -120)}px) scale(${lerp(1.25, 1, p) * (1 - 0.05 * po)})`,
              opacity: clamp(p * 3) * (1 - po),
              filter: `blur(${(1 - p) * 10}px)`,
            }}
          >
            <Check size={76} draw={prog(f, at + 4, 12)} color={theme.accent.main} />
            <div style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 64, letterSpacing: "-0.035em", color: theme.fg }}>{item}</div>
          </div>
        );
      })}
    </Abs>
  );
};
