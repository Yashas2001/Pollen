import React from "react";
import { Img } from "remotion";
import type { Asset } from "../schema";
import { Abs } from "../fx";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { backOut, clamp, cubicOut, expoOut, lerp, prog } from "../motion";

type Props = {
  f: number;
  cta: string;
  brandName: string;
  logoUrl: string | null;
  bgAsset: Asset | null;
  accent: { main: string; light: string; deep: string };
  theme: Theme;
};

// The film's "settle": the product sinks into a blurred backdrop, the line
// rises word by word, the logo lands, the CTA pill catches a glint.
export const EndCard: React.FC<Props> = ({ f, cta, brandName, logoUrl, bgAsset, accent, theme }) => {
  const domain = cta.match(/[a-z0-9-]+(\.[a-z0-9-]+)+/i)?.[0] ?? null;
  const line = (domain ? cta.replace(domain, "") : cta).replace(/[·|•\-–—:,]+\s*$/u, "").replace(/\s+(at|on)\s*$/i, "").trim() || brandName;
  const words = line.split(/\s+/);

  const reveal = prog(f, 0, 24, expoOut);
  const logo = prog(f, 4, 16, (t) => backOut(t, 1.8));
  const pill = prog(f, 14 + words.length * 3, 16, (t) => backOut(t, 1.6));
  const glint = prog(f, 32 + words.length * 3, 30, cubicOut);

  return (
    <Abs style={{ background: theme.bg }}>
      {bgAsset ? (
        <Abs
          style={{
            filter: theme.dark
              ? `blur(${lerp(30, 18, reveal)}px) brightness(${lerp(0.6, 0.25, reveal)}) saturate(0.9)`
              : `blur(${lerp(40, 30, reveal)}px) brightness(1.15) saturate(1.1)`,
            opacity: theme.dark ? 1 : 0.45,
            transform: `scale(${lerp(1.2, 1.05, reveal)})`,
          }}
        >
          <Img src={bgAsset.url} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </Abs>
      ) : null}
      <Abs style={{ background: `radial-gradient(ellipse 60% 40% at 50% 46%, ${accent.deep}55, transparent 70%)` }} />
      <Abs style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 64, padding: "0 80px" }}>
        {logoUrl ? (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 52,
              background: "rgba(255,255,255,0.96)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${logo})`,
              boxShadow: `0 0 100px ${accent.main}aa, 0 30px 60px rgba(0,0,0,0.7)`,
            }}
          >
            <Img src={logoUrl} style={{ width: 140, height: 140, objectFit: "contain" }} />
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 26px",
            fontFamily: HEADLINE_FONT,
            fontWeight: 800,
            fontSize: 104,
            letterSpacing: "-0.045em",
            lineHeight: 1.08,
            textAlign: "center",
          }}
        >
          {words.map((w, i) => {
            const p = prog(f, 8 + i * 3, 16, expoOut);
            const last = i >= words.length - 2;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - p) * 50}px)`,
                  opacity: p,
                  filter: `blur(${(1 - p) * 10}px)`,
                  ...(last
                    ? { background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
                    : { color: theme.fg }),
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        {domain ? (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "18px 18px 18px 44px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${accent.main}, ${accent.deep})`,
              border: "1px solid rgba(255,255,255,0.28)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 20px 50px -10px ${accent.main}`,
              fontFamily: HEADLINE_FONT,
              fontWeight: 700,
              fontSize: 48,
              color: theme.accent.onMain,
              transform: `scale(${pill})`,
              opacity: clamp(pill * 2),
            }}
          >
            {domain}
            <span style={{ width: 70, height: 70, borderRadius: 35, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
              →
            </span>
            {glint > 0 && glint < 1 ? (
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${lerp(-30, 130, glint)}%`, width: "22%", background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)" }} />
            ) : null}
          </div>
        ) : null}
      </Abs>
    </Abs>
  );
};
