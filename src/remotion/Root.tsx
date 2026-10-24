import React from "react";
import { Composition } from "remotion";
import { SocialVideo, totalFrames } from "./SocialVideo";
import { FPS, HEIGHT, WIDTH, type VideoProps } from "./schema";
import { sampleProps } from "./sample";

export const COMPOSITION_ID = "SocialVideo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={SocialVideo}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    durationInFrames={totalFrames(sampleProps)}
    defaultProps={sampleProps}
    calculateMetadata={({ props }: { props: VideoProps }) => ({ durationInFrames: totalFrames(props) })}
  />
);
