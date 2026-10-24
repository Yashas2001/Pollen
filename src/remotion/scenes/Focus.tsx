import React from "react";
import { Img } from "remotion";
import type { Asset, SiteElement } from "../schema";
import { WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { HEADLINE_FONT } from "../fonts";
import { Abs } from "../fx";
import { backOut, clamp, expoInOut, expoOut, lerp, prog } from "../motion";
import { Cursor } from "./common";

type Props = { f: number; dur: number; page: Asset; el: SiteElement; theme: Theme; label: string };

// A real walkthrough: the camera starts on the page, dives into one real button or
// section, a cursor glides over and clicks it, it lights up.
export const FocusScene: React.FC<Props> = ({ f, dur, page, el, theme, label }) => {
  const viewW = 900;
  const viewH = 1000;
  const top = 560;
  const left = (W - viewW) / 2;

  // camera: page overview -> element fills ~75% of the view
  const enter = prog(f, 0, 14, expoOut);
  const dive = prog(f, 6, Math.min(26, dur * 0.4), expoInOut);
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const zoomTo = clamp((viewW * 0.75) / Math.max(el.w, 1), 0.9, 3.2);
  const zoomFrom = viewW / page.width;
  const z = lerp(zoomFrom, zoomTo, dive);
  const startCy = Math.max(viewH / 2 / zoomFrom, cy - 600);
  const camY = lerp(startCy, cy, dive);
  const camX = lerp(page.width / 2, cx, dive);
  const tx = viewW / 2 - camX * z;
  const ty = viewH / 2 - camY * z;

  // cursor: glides in after the dive, clicks
  const clickAt = Math.min(dur - 12, 6 + Math.min(26, dur * 0.4) + 10);
  const move = prog(f, clickAt - 14, 14, expoInOut);
  const press = prog(f, clickAt, 3) * (1 - prog(f, clickAt + 3, 6));
  const ring = prog(f, clickAt, 18);
  const lit = prog(f, clickAt, 10, expoOut);
  const out = prog(f, dur - 7, 7, (t) => t * t);
  const curX = lerp(viewW + 80, viewW / 2 + 10, move);
  const curY = lerp(viewH + 60, viewH / 2 + 6, move);
  const elW = el.w * z;
  const elH = el.h * z;

  return (
    <Abs style={{ opacity: 1 - out }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: viewW,
          height: viewH,
          borderRadius: 48,
          overflow: "hidden",
          border: theme.dark ? `2px solid ${theme.accent.main}` : "12px solid #fff",
          boxShadow: theme.cardShadow,
          background: theme.card,
          transform: `perspective(1800px) rotateX(${lerp(12, 3, enter)}deg) scale(${lerp(0.9, 1, enter)})`,
          opacity: clamp(enter * 2),
        }}
      >
        <Img
          src={page.url}
          style={{ position: "absolute", left: 0, top: 0, width: page.width, height: page.height, maxWidth: "none", transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}
        />
        {/* the element lights up when clicked */}
        <div
          style={{
            position: "absolute",
            left: viewW / 2 - elW / 2 - 14,
            top: viewH / 2 - elH / 2 - 14,
            width: elW + 28,
            height: elH + 28,
            borderRadius: 24,
            border: `5px solid ${theme.accent.main}`,
            boxShadow: `0 0 50px ${theme.accent.main}, inset 0 0 30px ${theme.accent.main}55`,
            opacity: lit * (1 - out),
            transform: `scale(${lerp(1.15, 1, lit)})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: viewW / 2 - 90 * ring * 1.6,
            top: viewH / 2 - 90 * ring * 1.6,
            width: 180 * ring * 1.6,
            height: 180 * ring * 1.6,
            borderRadius: "50%",
            border: `4px solid ${theme.accent.light}`,
            opacity: ring > 0 && ring < 1 ? 1 - ring : 0,
          }}
        />
        {move > 0 ? <Cursor x={curX} y={curY} press={press} scale={1.3} /> : null}
      </div>
      {label ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: top + viewH - 20,
            transform: `translateX(-50%) scale(${prog(f, clickAt + 2, 12, (t) => backOut(t, 2.2))})`,
            padding: "14px 30px",
            borderRadius: 999,
            background: theme.accent.main,
            color: theme.accent.onMain,
            fontFamily: HEADLINE_FONT,
            fontWeight: 700,
            fontSize: 36,
            whiteSpace: "nowrap",
            boxShadow: `0 16px 40px ${theme.accent.main}88`,
          }}
        >
          {label}
        </div>
      ) : null}
    </Abs>
  );
};
