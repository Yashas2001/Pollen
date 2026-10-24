import React from "react";
import { Img } from "remotion";
import type { Asset, Brand, FormatId, Shot, SiteElement } from "../schema";
import { WIDTH as W } from "../schema";
import type { Theme } from "../theme";
import { Abs, Shock, Sparks } from "../fx";
import { HEADLINE_FONT } from "../fonts";
import { backOut, clamp, expoOut, lerp, prog } from "../motion";
import { Title } from "./Title";
import { Panel } from "../scenes/Panel";
import { PromptScene } from "../scenes/Prompt";
import { FanScene } from "../scenes/Fan";
import { FocusScene } from "../scenes/Focus";
import { ChecklistScene } from "../scenes/Checklist";
import { BeforeAfterScene } from "../scenes/BeforeAfter";
import { FootageScene, Punch, TalkScene } from "../scenes/Footage";

type Props = {
  f: number; // local frame
  dur: number;
  shot: Shot;
  index: number;
  format: FormatId;
  brand: Brand;
  theme: Theme;
  assets: Asset[];
  elements: SiteElement[];
  logoUrl: string | null;
  // The video runs on their own clip: every shot uses punch words, like a creator's edit.
  clipMode?: boolean;
};

const PROBLEM: [string, string] = ["#FF6B8B", "#FF9A62"];

export const ShotView: React.FC<Props> = ({ f, dur, shot, index, format, brand, theme, assets, elements, logoUrl, clipMode = false }) => {
  const isHook = index === 0;
  const grad: [string, string] = shot.mood === "problem" ? PROBLEM : theme.gradient;
  const asset = assets[shot.assetIndex] ?? null;
  const reason = format === "three_reasons" && index >= 1 && index <= 3 ? index : null;
  const text = reason !== null ? shot.onScreenText.replace(/^\s*\d+\s*[.):-]?\s*/, "") : shot.onScreenText;
  const titleColors = { color: theme.fg, shadow: theme.textShadow };

  // Decide what the scene can actually show with what we have.
  let scene = shot.scene;
  const page = assets.find((a) => a.kind === "screenshot_full") ?? null;
  const el = elements[shot.elementIndex] ?? null;
  const isVideo = (a: Asset | null) => a?.kind === "video" || a?.kind === "talk";
  const talk = asset?.kind === "talk" ? asset : (assets.find((a) => a.kind === "talk") ?? null);
  if (scene === "talk" && !talk) scene = "type";
  // stock shots become footage once a clip is found; one that found nothing shows the words
  if (scene === "stock") scene = isVideo(asset) ? "footage" : "type";
  if (scene === "footage" && !isVideo(asset)) scene = asset ? "panel" : "type";
  // a video can't sit in an image scene: show it as footage
  if (scene !== "talk" && scene !== "footage" && isVideo(asset)) scene = "footage";
  if (scene === "focus" && (!page || !el)) scene = asset ? "panel" : "type";
  if ((scene === "panel" || scene === "before_after") && !asset) scene = "type";
  if (scene === "checklist" && shot.items.length === 0) scene = asset ? "panel" : "type";

  if (scene === "talk" && talk) {
    return (
      <>
        <TalkScene f={f} dur={dur} asset={talk} clipStart={shot.clipStart ?? 0} index={index} />
        <Punch f={f} dur={dur} text={text} y={isHook ? 300 : 1060} />
      </>
    );
  }

  if (scene === "footage" && asset) {
    return (
      <>
        <FootageScene f={f} dur={dur} asset={asset} clipStart={shot.clipStart ?? 0} theme={theme} index={index} />
        <Punch f={f} dur={dur} text={text} y={asset.height / Math.max(1, asset.width) >= 1.3 ? 720 : 300} />
      </>
    );
  }

  if (scene === "logo") {
    const s = prog(f, 0, 16, (t) => backOut(t, 2));
    return (
      <Abs style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70, padding: 90 }}>
        <Shock x={W / 2} y={760} p={prog(f, 2, 26)} r={420} color={theme.accent.main} />
        <Sparks x={W / 2} y={760} p={prog(f, 2, 22)} color={theme.accent.light} seed={index} />
        {logoUrl ? (
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 72,
              background: "rgba(255,255,255,0.96)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${s})`,
              boxShadow: theme.dark ? `0 0 120px ${theme.accent.main}, 0 40px 80px rgba(0,0,0,0.7)` : theme.cardShadow,
            }}
          >
            <Img src={logoUrl} style={{ width: 210, height: 210, objectFit: "contain" }} />
          </div>
        ) : null}
        <Title f={f} dur={dur} text={text} highlight={shot.highlight} gradient={grad} size={104} kind="blur" delay={6} {...titleColors} />
      </Abs>
    );
  }

  if (scene === "type") {
    return (
      <Abs style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        {isHook ? (
          <>
            <Shock x={W / 2} y={900} p={prog(f, 0, 24)} r={620} color={theme.accent.main} w={14} />
            <Sparks x={W / 2} y={900} p={prog(f, 0, 20)} r={420} n={20} color={theme.accent.light} />
          </>
        ) : null}
        {/* never frozen: a slow push the whole time the line is up */}
        <div style={{ transform: `scale(${lerp(1, 1.08, prog(f, 0, dur))})` }}>
          <Title f={f} dur={dur} text={text} highlight={shot.highlight} gradient={grad} size={isHook ? 150 : 124} kind={isHook ? "beats" : "rise"} {...titleColors} />
        </div>
      </Abs>
    );
  }

  const numIn = prog(f, 0, 14, expoOut);
  const fanPool = assets.filter((a) => a.kind === "image").length ? assets.filter((a) => a.kind === "image") : assets;

  return (
    <>
      {scene === "panel" && asset ? <Panel f={f} dur={dur} asset={asset} index={index} theme={theme} dim={shot.mood === "problem"} top={560} /> : null}
      {scene === "prompt" ? <PromptScene f={f} dur={dur} prompt={shot.prompt || shot.onScreenText} asset={asset} brandName={brand.name} theme={theme} /> : null}
      {scene === "fan" ? <FanScene f={f} dur={dur} assets={fanPool} items={shot.items} theme={theme} startIndex={Math.max(0, fanPool.indexOf(asset!))} /> : null}
      {scene === "focus" && page && el ? <FocusScene f={f} dur={dur} page={page} el={el} theme={theme} label={el.kind === "button" ? "" : el.label.slice(0, 28)} /> : null}
      {scene === "checklist" ? <ChecklistScene f={f} dur={dur} items={shot.items} theme={theme} /> : null}
      {scene === "before_after" && asset ? (
        <BeforeAfterScene f={f} dur={dur} before={asset} after={assets[shot.secondAssetIndex] ?? asset} labels={shot.items} theme={theme} />
      ) : null}

      {clipMode ? <Punch f={f} dur={dur} text={text} y={250} /> : null}
      <div style={{ display: clipMode ? "none" : "flex", position: "absolute", left: 0, right: 0, top: 150, height: 380, alignItems: "center", gap: 30, padding: "0 80px", justifyContent: reason !== null ? "flex-start" : "center" }}>
        {reason !== null ? (
          <div
            style={{
              fontFamily: HEADLINE_FONT,
              fontWeight: 800,
              fontSize: 240,
              lineHeight: 0.9,
              letterSpacing: "-0.06em",
              color: "transparent",
              WebkitTextStroke: `4px ${theme.dark ? theme.accent.main : theme.accent.ink}`,
              filter: theme.dark ? `drop-shadow(0 0 30px ${theme.accent.main})` : undefined,
              transform: `translateX(${lerp(-80, 0, numIn)}px) scale(${lerp(1.3, 1, numIn)})`,
              opacity: clamp(numIn * 2) * (1 - prog(f, dur - 8, 8)),
            }}
          >
            {String(reason).padStart(2, "0")}
          </div>
        ) : null}
        <div style={{ flex: reason !== null ? 1 : undefined }}>
          <Title
            f={f}
            dur={dur}
            text={text}
            highlight={shot.highlight}
            gradient={grad}
            size={isHook ? 104 : 86}
            align={reason !== null ? "left" : "center"}
            kind={isHook ? "slam" : "blur"}
            {...titleColors}
          />
        </div>
      </div>
      {clipMode ? null : <div style={{ position: "absolute", left: 60, top: 70, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 30, color: theme.sub, opacity: numIn }}>{brand.name}</div>}
    </>
  );
};
