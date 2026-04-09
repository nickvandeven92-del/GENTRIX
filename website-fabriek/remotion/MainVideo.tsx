import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { PersistentAccents } from "./PersistentAccents";
import { PersistentBackground } from "./PersistentBackground";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2LaserReveal } from "./scenes/Scene2LaserReveal";
import { Scene3Services } from "./scenes/Scene3Services";
import { Scene4Precision } from "./scenes/Scene4Precision";
import { Scene5Outro } from "./scenes/Scene5Outro";

export type MainVideoProps = {
  brandName?: string;
  tagline?: string;
};

const S1 = 80;
const S2 = 70;
const S3 = 120;
const S4 = 90;
const S5 = 100;

export const MainVideo: FC<MainVideoProps> = ({ brandName = "Studio", tagline = "Promo" }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#030712", fontFamily: "system-ui, sans-serif" }}>
      <PersistentBackground />
      <PersistentAccents />
      <Sequence from={0} durationInFrames={S1}>
        <Scene1Intro brandName={brandName} tagline={tagline} />
      </Sequence>
      <Sequence from={S1} durationInFrames={S2}>
        <Scene2LaserReveal />
      </Sequence>
      <Sequence from={S1 + S2} durationInFrames={S3}>
        <Scene3Services />
      </Sequence>
      <Sequence from={S1 + S2 + S3} durationInFrames={S4}>
        <Scene4Precision />
      </Sequence>
      <Sequence from={S1 + S2 + S3 + S4} durationInFrames={S5}>
        <Scene5Outro brandName={brandName} />
      </Sequence>
    </AbsoluteFill>
  );
};
