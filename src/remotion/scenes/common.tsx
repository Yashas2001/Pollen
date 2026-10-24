import React from "react";
import { Img } from "remotion";
import type { Asset } from "../schema";
import type { Theme } from "../theme";

// A mouse pointer, drawn, with a soft shadow.
export const Cursor: React.FC<{ x: number; y: number; press: number; scale?: number }> = ({ x, y, press, scale = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `scale(${scale * (1 - 0.15 * press)})`, transformOrigin: "0 0", filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.45))" }}>
    <svg width={64} height={64} viewBox="0 0 32 32">
      <path d="M6 3l19 12.5-8.2 1.4L21.5 27l-3.6 1.6-4.7-10.2L7 23.6z" fill="#fff" stroke="#111" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  </div>
);

// An image in a card: white frame in the light look, glowing edge in the dark one.
export const ImageCard: React.FC<{
  asset: Asset;
  w: number;
  h: number;
  theme: Theme;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  radius?: number;
}> = ({ asset, w, h, theme, style, imgStyle, radius = 44 }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: radius,
      overflow: "hidden",
      border: theme.dark ? `2px solid ${theme.accent.main}` : "10px solid #fff",
      boxShadow: theme.cardShadow,
      background: theme.card,
      ...style,
    }}
  >
    <Img src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: asset.kind === "image" ? "center" : "top", display: "block", ...imgStyle }} />
  </div>
);

// Drawn check mark (stroke-dash draw-on), like the film's icons.
export const Check: React.FC<{ size: number; draw: number; color: string }> = ({ size, draw, color }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx={16} cy={16} r={14} fill={color} opacity={Math.min(1, draw * 2)} />
    <path d="M9 16.5l5 5L23.5 11" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, draw * 1.6 - 0.4))} />
  </svg>
);
