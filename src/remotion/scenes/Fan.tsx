import React from "react";
import type { Asset } from "../schema";
import { WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { Abs, Sparks } from "../fx";
import { backOut, clamp, expoOut, lerp, prog } from "../motion";
import { ImageCard } from "./common";

type Props = { f: number; dur: number; assets: Asset[]; items: string[]; theme: Theme; startIndex: number };

// One image bursts into a fan of versions, each with a label ("TikTok", "Ad", "Story"...).
export const FanScene: React.FC<Props> = ({ f, dur, assets, items, theme, startIndex }) => {
  const labels = items.length ? items.slice(0, 5) : ["Reels", "TikTok", "Shorts", "Ads"];
  const n = Math.max(3, labels.length);
  const pool = assets.length ? assets : [];
  const burst = prog(f, 8, 20, expoOut);
  const drift = prog(f, 0, dur);
  const out = prog(f, dur - 7, 7, (t) => t * t);
  const cw = 380;
  const ch = 560;
  const cy = 1060;

  return (
    <Abs style={{ opacity: 1 - out }}>
      <Sparks x={W / 2} y={cy} p={prog(f, 8, 22)} r={520} n={22} color={theme.accent.light} />
      {Array.from({ length: n }).map((_, i) => {
        const a = pool[(startIndex + i) % Math.max(1, pool.length)];
        const spread = (i - (n - 1) / 2) / ((n - 1) / 2 || 1); // -1..1
        const angle = spread * 26 * burst + spread * 3 * drift;
        const x = spread * 330 * burst;
        const y = Math.abs(spread) * 90 * burst - drift * 20;
        const p = prog(f, 8 + i * 2, 16, (t) => backOut(t, 1.6));
        const label = labels[i % labels.length];
        const center = i === Math.floor((n - 1) / 2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2 - cw / 2 + x,
              top: cy - ch / 2 + y,
              transform: `rotate(${angle}deg) scale(${center ? lerp(1.12, 1, burst) : lerp(0.6, 0.94, p)})`,
              transformOrigin: "50% 120%",
              zIndex: center ? 10 : 10 - Math.abs(i - (n - 1) / 2),
              opacity: center ? 1 : clamp(p * 2),
            }}
          >
            {a ? (
              <ImageCard
                asset={a}
                w={cw}
                h={ch}
                theme={theme}
                radius={36}
                // variations: same image, different looks
                imgStyle={{ filter: center ? undefined : `hue-rotate(${(i - 2) * 38}deg) saturate(${1 + 0.2 * Math.abs(spread)})` }}
              />
            ) : (
              <div style={{ width: cw, height: ch, borderRadius: 36, background: `linear-gradient(160deg, ${theme.accent.light}, ${theme.accent.deep})`, boxShadow: theme.cardShadow }} />
            )}
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: -34,
                transform: `translateX(-50%) scale(${prog(f, 20 + i * 3, 12, (t) => backOut(t, 2.2))})`,
                padding: "12px 26px",
                borderRadius: 999,
                background: center ? theme.accent.main : theme.dark ? "rgba(20,20,30,0.95)" : "#fff",
                color: center ? theme.accent.onMain : theme.fg,
                border: theme.dark ? `1.5px solid ${theme.accent.main}` : "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                fontFamily: HEADLINE_FONT,
                fontWeight: 700,
                fontSize: 32,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </Abs>
  );
};
