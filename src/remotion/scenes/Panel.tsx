import React from "react";
import { Img } from "remotion";
import type { Asset } from "../schema";
import { HEIGHT as H, WIDTH as W } from "../schema";
import { Abs } from "../fx";
import type { Theme } from "../theme";
import { clamp, expoOut, lerp, prog, sineIO } from "../motion";

// Camera angles, so consecutive shots never sit at the same tilt.
const ANGLES = [
  { rx: 10, ry: -16, rz: -2 },
  { rx: 8, ry: 15, rz: 1.5 },
  { rx: 16, ry: -6, rz: 0 },
  { rx: 6, ry: 10, rz: -1 },
];

type Props = {
  f: number;
  dur: number;
  asset: Asset;
  index: number;
  theme: Theme;
  dim: boolean; // "problem" shots: washed out
  top: number;
};

// The product, floating in 3D on the dark stage: glowing edge, a slow camera
// drift, and a full-page screenshot scrolling inside like someone is using it.
export const Panel: React.FC<Props> = ({ f, dur, asset, index, theme, dim, top }) => {
  const a = ANGLES[index % ANGLES.length];
  const enter = prog(f, 0, 18, expoOut);
  const drift = sineIO(clamp(f / Math.max(1, dur)));
  const out = prog(f, dur - 7, 7, (t) => t * t);

  // Photos keep their own shape; screenshots sit in a tall phone-like card.
  const isPhoto = asset.kind === "image";
  const cardW = isPhoto ? 880 : 800;
  const cardH = isPhoto ? Math.min(1100, Math.max(560, (asset.height / asset.width) * cardW)) : 1100;
  const imgH = (asset.height / asset.width) * cardW;
  const scrollable = asset.kind === "screenshot_full" && imgH > cardH * 1.2;
  const maxScroll = Math.min(imgH - cardH, cardH * 1.8);
  // Each use of the long screenshot starts further down, so repeats show new parts.
  const startAt = scrollable ? ((index * 0.33) % 1) * maxScroll * 0.6 : 0;
  const scroll = scrollable ? startAt + (maxScroll - startAt) * 0.55 * drift : 0;

  const rx = lerp(a.rx * 1.8, a.rx * 0.5, enter) - drift * 2;
  const ry = lerp(a.ry * 1.8, a.ry * 0.6, enter) + drift * (a.ry > 0 ? -4 : 4);
  const rz = lerp(a.rz * 2, a.rz, enter);
  const z = lerp(0.82, 1, enter) + drift * 0.05 + out * 0.15;
  const whip = (1 - enter) * (index % 2 ? 1 : -1) * 260;

  return (
    <>
      {/* ambient: the same image, huge and blurred, lights the stage around it */}
      <Abs style={{ opacity: (theme.dark ? 0.35 : 0.6) * enter * (1 - out), filter: "blur(70px) saturate(1.4)", transform: "scale(1.3)" }}>
        <Img src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      </Abs>
      <div
        style={{
          position: "absolute",
          left: 0,
          top,
          width: W,
          height: H - top,
          perspective: 1800,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: cardW,
            height: cardH,
            borderRadius: 56,
            overflow: "hidden",
            position: "relative",
            transform: `translateX(${whip}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${z})`,
            transformOrigin: "50% 40%",
            opacity: clamp(enter * 2) * (1 - out),
            filter: `blur(${(1 - enter) * 14 + out * 10}px)${dim ? " grayscale(0.85) brightness(0.7)" : ""}`,
            border: theme.dark ? `2px solid ${theme.accent.main}` : "12px solid #fff",
            boxShadow: theme.cardShadow,
            background: theme.card,
          }}
        >
          <Img
            src={asset.url}
            style={{
              width: cardW,
              height: scrollable ? imgH : cardH,
              objectFit: "cover",
              objectPosition: "top",
              transform: `translateY(${-scroll}px)`,
              display: "block",
            }}
          />
          {/* glass sheen sweeping across */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(115deg, transparent ${lerp(-20, 80, drift)}%, rgba(255,255,255,0.10) ${lerp(-10, 90, drift)}%, transparent ${lerp(0, 100, drift)}%)`,
            }}
          />
        </div>
      </div>
    </>
  );
};
