import React from "react";
import { HEIGHT as H, WIDTH as W } from "./schema";
import { clamp, hash, noise1 } from "./motion";

// Atmosphere from the launch film: grain, vignette, dust, flashes, shock rings.

export const Abs: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{ position: "absolute", inset: 0, ...style }}>{children}</div>
);

export const Grain: React.FC<{ f: number; o?: number }> = ({ f, o = 0.06 }) => (
  <Abs style={{ opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <svg width={W} height={H}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(f) % 97} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={W} height={H} filter="url(#grain)" />
    </svg>
  </Abs>
);

export const Vignette: React.FC<{ o?: number }> = ({ o = 0.7 }) => (
  <Abs style={{ background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 50%, rgba(0,0,0,${o}) 100%)` }} />
);

export const Dust: React.FC<{ f: number; n?: number; color: string }> = ({ f, n = 40, color }) => (
  <Abs>
    {Array.from({ length: n }).map((_, i) => {
      const depth = 0.3 + hash(i * 3.1) * 1.2;
      const x = hash(i) * W + noise1(f * 0.008 + i, i) * 60;
      const y = ((hash(i * 7.7) * H * 1.2 - f * depth * 0.9) % (H * 1.2) + H * 1.2) % (H * 1.2) - H * 0.1;
      const s = 2 + depth * 3;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f * 0.06 + i));
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: s,
            height: s,
            borderRadius: "50%",
            background: color,
            opacity: tw * 0.5 * Math.min(1, depth),
            boxShadow: `0 0 ${s * 3}px ${color}`,
            filter: depth < 0.5 ? "blur(1.5px)" : undefined,
          }}
        />
      );
    })}
  </Abs>
);

export const Flash: React.FC<{ v: number; color: string }> = ({ v, color }) =>
  v > 0.003 ? <Abs style={{ background: color, opacity: clamp(v), mixBlendMode: "screen" }} /> : null;

/** Expanding ring. p: 0..1 */
export const Shock: React.FC<{ x: number; y: number; p: number; r: number; color: string; w?: number }> = ({
  x,
  y,
  p,
  r,
  color,
  w = 10,
}) => {
  if (p <= 0 || p >= 1) return null;
  const rr = r * (1 - Math.pow(1 - p, 3));
  return (
    <div
      style={{
        position: "absolute",
        left: x - rr,
        top: y - rr,
        width: rr * 2,
        height: rr * 2,
        borderRadius: "50%",
        border: `${Math.max(0.5, w * (1 - p))}px solid ${color}`,
        opacity: 1 - p,
        boxShadow: `0 0 30px ${color}, inset 0 0 30px ${color}`,
      }}
    />
  );
};

/** Radial burst of spark streaks. p: 0..1 */
export const Sparks: React.FC<{ x: number; y: number; p: number; n?: number; r?: number; color: string; seed?: number }> = ({
  x,
  y,
  p,
  n = 16,
  r = 300,
  color,
  seed = 0,
}) => {
  if (p <= 0 || p >= 1) return null;
  const e = 1 - Math.pow(1 - p, 3);
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + hash(i + seed) * 0.5;
        const d0 = r * (0.55 + hash(i * 2 + seed) * 0.6) * e;
        const len = (1 - p) * 50 + 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * d0,
              top: y + Math.sin(a) * d0,
              width: len,
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${color})`,
              transform: `translate(-100%, -50%) rotate(${a}rad)`,
              transformOrigin: "100% 50%",
              opacity: 1 - p,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

export const gradText = (a: string, b: string): React.CSSProperties => ({
  background: `linear-gradient(90deg, ${a}, ${b})`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});
