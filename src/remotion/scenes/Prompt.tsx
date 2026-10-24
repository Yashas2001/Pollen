import React from "react";
import type { Asset } from "../schema";
import { WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { Abs, Shock } from "../fx";
import { backOut, clamp, cubicOut, expoOut, lerp, prog } from "../motion";
import { ImageCard } from "./common";

type Props = { f: number; dur: number; prompt: string; asset: Asset | null; brandName: string; theme: Theme };

// The CapCut move: a prompt types itself, send is pressed, the result lands.
export const PromptScene: React.FC<Props> = ({ f, dur, prompt, asset, brandName, theme }) => {
  const barIn = prog(f, 0, 14, expoOut);
  const typeEnd = Math.max(14, dur * 0.42);
  const chars = Math.floor(prompt.length * prog(f, 6, typeEnd - 6));
  const pressAt = typeEnd + 4;
  const press = prog(f, pressAt, 4) * (1 - prog(f, pressAt + 4, 6));
  const reveal = prog(f, pressAt + 6, 18, expoOut);
  const drift = prog(f, 0, dur, cubicOut);
  const out = prog(f, dur - 7, 7, (t) => t * t);
  const caretOn = Math.floor(f / 8) % 2 === 0 || f < typeEnd;

  const cardW = 860;
  const cardH = asset && asset.kind === "image" ? Math.min(820, Math.max(520, (asset.height / asset.width) * cardW)) : 820;

  return (
    <Abs style={{ opacity: 1 - out }}>
      {/* the result, waiting blurred until the prompt is sent */}
      {asset ? (
        <div
          style={{
            position: "absolute",
            left: (W - cardW) / 2,
            top: 1120 - cardH,
            transform: `perspective(1800px) rotateX(${lerp(14, 4, drift)}deg) rotateY(${lerp(-10, -3, drift)}deg) scale(${lerp(0.86, 1, reveal) + drift * 0.03})`,
            filter: `blur(${(1 - reveal) * 26}px) saturate(${lerp(0.4, 1, reveal)})`,
            opacity: lerp(0.35, 1, reveal),
          }}
        >
          <ImageCard asset={asset} w={cardW} h={cardH} theme={theme} />
          {reveal > 0 && reveal < 1 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 44,
                background: `linear-gradient(115deg, transparent ${lerp(-30, 110, reveal)}%, rgba(255,255,255,0.55) ${lerp(-15, 125, reveal)}%, transparent ${lerp(0, 140, reveal)}%)`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      <Shock x={W / 2} y={760} p={prog(f, pressAt + 6, 22)} r={520} color={theme.accent.main} />

      {/* the prompt bar */}
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 1190,
          padding: "34px 40px 28px",
          borderRadius: 44,
          background: theme.dark ? "rgba(20,20,30,0.92)" : "#FFFFFF",
          border: theme.dark ? `1.5px solid ${theme.accent.main}88` : "1px solid rgba(0,0,0,0.06)",
          boxShadow: theme.dark ? `0 30px 80px rgba(0,0,0,0.8), 0 0 60px -10px ${theme.accent.main}` : "0 30px 80px -20px rgba(30,30,60,0.35)",
          transform: `translateY(${(1 - barIn) * 80}px) scale(${1 - 0.02 * press})`,
          opacity: clamp(barIn * 2),
          fontFamily: HEADLINE_FONT,
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 600, letterSpacing: "-0.02em", color: theme.fg, minHeight: 70, lineHeight: 1.15 }}>
          {prompt.slice(0, chars)}
          <span style={{ display: "inline-block", width: 4, height: 62, marginLeft: 4, verticalAlign: "-8px", background: theme.accent.main, opacity: caretOn && reveal < 0.5 ? 1 : 0 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: theme.accent.main, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 34 }}>✦</span>
            {brandName}
          </div>
          <div
            style={{
              marginLeft: "auto",
              width: 92,
              height: 92,
              borderRadius: 46,
              background: theme.dark ? theme.accent.main : "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${1 - 0.18 * press + 0.12 * prog(f, pressAt + 4, 10, (t) => backOut(t, 3)) * (1 - prog(f, pressAt + 14, 10))})`,
              boxShadow: press > 0 ? `0 0 40px ${theme.accent.main}` : undefined,
            }}
          >
            <svg width={44} height={44} viewBox="0 0 32 32">
              <path d="M16 26V7M8 14l8-8 8 8" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </Abs>
  );
};
