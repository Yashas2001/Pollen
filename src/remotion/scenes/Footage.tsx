import React from "react";
// Video from @remotion/media, not remotion's OffthreadVideo: the in-browser renderer (Download) only supports this one.
import { Video } from "@remotion/media";
import type { Asset } from "../schema";
import { FPS, HEIGHT as H, WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { PUNCH_FONT } from "../fonts";
import { Abs } from "../fx";
import { backOut, clamp, expoOut, lerp, prog } from "../motion";

// Real footage, full screen, the way winning Shorts cut it: no frames or cards,
// a punch-in on the cut, a slow push while it plays.

// Start inside the clip so the shot never runs past its end; a clip shorter than
// the shot plays a little slower instead of freezing.
function trim(asset: Asset, clipStart: number, dur: number) {
  const len = asset.durationSec ?? 0;
  const need = dur / FPS;
  if (!len) return { from: Math.max(0, Math.round(clipStart * FPS)), rate: 1 };
  if (len < need) return { from: 0, rate: Math.max(0.5, len / need) };
  return { from: Math.round(clamp(clipStart, 0, len - need) * FPS), rate: 1 };
}

export const FootageScene: React.FC<{ f: number; dur: number; asset: Asset; clipStart: number; theme: Theme; index: number }> = ({ f, dur, asset, clipStart, theme, index }) => {
  const { from, rate } = trim(asset, Math.max(0, clipStart), dur);
  const tall = asset.height / Math.max(1, asset.width) >= 1.3;
  const hit = prog(f, 0, 10, expoOut);
  const push = prog(f, 0, dur);
  const out = prog(f, dur - 4, 4);

  if (tall) {
    const s = lerp(1.14, 1, hit) * lerp(1, 1.07, push);
    return (
      <Abs style={{ opacity: 1 - out * 0.4 }}>
        <Video src={asset.url} muted trimBefore={from} playbackRate={rate} style={{ width: W, height: H, objectFit: "cover", transform: `scale(${s})` }} />
      </Abs>
    );
  }

  // Wide footage (desktop screen, landscape demo): full width, pushed in so the UI reads,
  // over a dark stage lit in the brand colour.
  const h = (W * asset.height) / Math.max(1, asset.width);
  const zoom = lerp(1.18, 1.05, hit) * lerp(1, 1.3, push);
  const dir = index % 2 ? -1 : 1;
  return (
    <Abs style={{ background: "#07070b" }}>
      <Abs style={{ background: `radial-gradient(ellipse 90% 40% at 50% 46%, ${theme.accent.deep}aa, transparent 75%)` }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: H * 0.45 - h / 2,
          width: W,
          height: h,
          overflow: "visible",
          transform: `scale(${zoom}) translateX(${dir * lerp(0, 30, push)}px)`,
          boxShadow: `0 40px 120px rgba(0,0,0,0.8), 0 0 80px ${theme.accent.main}55`,
        }}
      >
        <Video src={asset.url} muted trimBefore={from} playbackRate={rate} style={{ width: W, height: h, objectFit: "cover", display: "block" }} />
      </div>
    </Abs>
  );
};

// The person's own clip. Their voice runs on the main voice track, cut on the same
// phrases, so lips stay in sync. Every other cut punches in, like a jump cut.
export const TalkScene: React.FC<{ f: number; dur: number; asset: Asset; clipStart: number; index: number }> = ({ f, dur, asset, clipStart, index }) => {
  const from = Math.max(0, Math.round(clipStart * FPS));
  const close = index % 2 === 1;
  const s = (close ? 1.16 : 1) * lerp(1, 1.04, prog(f, 0, dur));
  return (
    <Abs>
      <Video
        src={asset.url}
        muted
        trimBefore={from}
        style={{ width: W, height: H, objectFit: "cover", transform: `scale(${s})`, transformOrigin: "50% 35%" }}
      />
    </Abs>
  );
};

// Big condensed words punched over footage, one at a time, yellow with a black edge.
export const Punch: React.FC<{ f: number; dur: number; text: string; y: number; color?: string }> = ({ f, dur, text, y, color = "#FFE14A" }) => {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return null;
  const size = words.join(" ").length > 14 ? 120 : 150;
  const out = prog(f, dur - 5, 5);
  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        top: y,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 26px",
        fontFamily: PUNCH_FONT,
        fontSize: size,
        lineHeight: 1.02,
        textAlign: "center",
        opacity: 1 - out,
      }}
    >
      {words.map((w, i) => {
        const p = prog(f, 2 + i * 5, 8, (t) => backOut(t, 2.6));
        return (
          <span
            key={i}
            style={{
              color,
              WebkitTextStroke: "10px #000",
              paintOrder: "stroke fill",
              textShadow: "0 10px 0 rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.5)",
              transform: `scale(${lerp(1.7, 1, p)}) rotate(${lerp(-6, 0, p)}deg)`,
              opacity: clamp(p * 3),
              display: "inline-block",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
