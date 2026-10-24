import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { VideoProps } from "./schema";
import { END_CARD_MS, FPS } from "./schema";
import { SCORE_FILE } from "./score";
import { useFontsReady } from "./fonts";
import { Abs, Dust, Flash, Grain, Vignette } from "./fx";
import { KICK_FRAMES, hitEnv, kickEnv, msToFrames, noise1 } from "./motion";
import { themeFor } from "./theme";
import { Img } from "remotion";
import { ShotView } from "./components/ShotView";
import { Captions } from "./components/Captions";
import { EndCard } from "./components/EndCard";

export const totalFrames = (p: VideoProps) => Math.max(FPS, msToFrames(p.durationMs + END_CARD_MS));

// Cuts land on the music: each shot start moves to the nearest kick (at most half
// a beat away from where the voice line starts), like every hit in the film.
function snapToKicks(frames: number[]): number[] {
  const out: number[] = [];
  frames.forEach((fr, i) => {
    if (i === 0) return out.push(0);
    let best = fr;
    let bestD = 8; // ~half a beat at 30 fps
    for (const k of KICK_FRAMES) {
      const d = Math.abs(k - fr);
      if (d < bestD) {
        best = k;
        bestD = d;
      }
    }
    out.push(Math.max(best, out[i - 1] + 8));
  });
  return out;
}

export const SocialVideo: React.FC<VideoProps> = (props) => {
  useFontsReady();
  const f = useCurrentFrame();
  const { script, durationMs } = props;
  const theme = themeFor(script.theme ?? "dark", props.brand.primary);
  const accent = theme.accent;
  // Light look: the product itself, huge and blurred, is the backdrop (CapCut-style).
  const backdrop = props.assets.find((a) => a.kind === "image") ?? props.assets.find((a) => a.kind === "screenshot_hero") ?? null;
  // Cuts snap to the music, except when the voice is their own clip: then the cuts
  // must stay exactly on the phrases or their lips drift off the words.
  const rawCuts = [...props.shotStartsMs.map(msToFrames), msToFrames(durationMs)];
  const endFrom = script.voice === "clip" ? rawCuts : snapToKicks(rawCuts);
  const starts = endFrom.slice(0, script.shots.length);
  const endCardFrom = endFrom[endFrom.length - 1];

  // The stage breathes with the kick; every cut flashes the brand colour.
  const kick = f < endCardFrom ? kickEnv(f, 5) : 0;
  const shake = f < starts[1] ? kickEnv(f, 4) * 10 : kickEnv(f, 4) * 3;
  const still = (i: number) => ["image", "screenshot_full", "screenshot_hero"].includes(props.assets[i]?.kind ?? "");
  const lastAsset = [...script.shots].reverse().find((s) => s.assetIndex >= 0 && still(s.assetIndex));

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: "hidden" }}>
      {!theme.dark && backdrop ? (
        <Abs style={{ filter: "blur(60px) saturate(1.2)", transform: `scale(${1.25 + noise1(f * 0.004, 7) * 0.05})`, opacity: 0.55 }}>
          <Img src={backdrop.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Abs>
      ) : null}
      <Abs
        style={{
          background: theme.dark
            ? `radial-gradient(ellipse 70% 45% at ${50 + noise1(f * 0.01, 4) * 12}% ${42 + noise1(f * 0.008, 5) * 8}%, ${accent.deep}${Math.round(40 + kick * 40).toString(16)}, transparent 70%)`
            : `radial-gradient(ellipse 80% 60% at 50% 45%, rgba(255,255,255,0.35), rgba(243,240,234,0.7) 80%)`,
        }}
      />
      {theme.dark ? <Dust f={f} color={accent.light} /> : null}

      <Abs
        style={{
          transform: `translate(${noise1(f * 0.9, 1) * shake}px, ${noise1(f * 0.9, 2) * shake}px) scale(${1 + kick * 0.012})`,
        }}
      >
        {script.shots.map((shot, i) => {
          const from = starts[i];
          const to = i + 1 < starts.length ? starts[i + 1] : endCardFrom;
          const dur = Math.max(1, to - from);
          return (
            <Sequence key={i} from={from} durationInFrames={dur}>
              <ShotView
                f={f - from}
                dur={dur}
                shot={shot}
                index={i}
                format={script.format}
                brand={props.brand}
                theme={theme}
                assets={props.assets}
                elements={props.elements ?? []}
                logoUrl={props.logoUrl}
                clipMode={script.voice === "clip"}
              />
            </Sequence>
          );
        })}
      </Abs>

      <Sequence from={endCardFrom}>
        <EndCard
          f={f - endCardFrom}
          cta={script.cta}
          brandName={props.brand.name}
          logoUrl={props.logoUrl}
          bgAsset={lastAsset ? (props.assets[lastAsset.assetIndex] ?? null) : null}
          accent={accent}
          theme={theme}
        />
      </Sequence>

      <Sequence durationInFrames={endCardFrom}>
        <Captions captions={props.captions} accent={accent.onMain === "#FFFFFF" ? accent.deep : accent.main} onAccent={accent.onMain} />
      </Sequence>

      <Flash v={hitEnv(f, [0], 6) * 0.5 + hitEnv(f, starts.slice(1), 4) * 0.16 + hitEnv(f, [endCardFrom], 5) * 0.3} color={accent.main} />
      <Vignette o={script.voice === "clip" ? 0.22 : theme.dark ? 0.6 : 0.18} />
      <Grain f={f} o={theme.dark ? 0.05 : 0.03} />

      {props.voiceUrl ? <Audio src={props.voiceUrl} /> : null}
      <Audio
        src={props.musicUrl ?? staticFile(SCORE_FILE)}
        // Under the voice the music sits low; on the end card it comes up.
        volume={(fr) => (fr < endCardFrom ? (script.voice === "clip" ? 0.1 : 0.16) : Math.min(0.55, 0.16 + (fr - endCardFrom) * 0.03))}
      />
    </AbsoluteFill>
  );
};
