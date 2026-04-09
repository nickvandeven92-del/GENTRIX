import type { FC } from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

/** Entry compositions voor Studio / promo-renders. */
export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="StudioPromo"
        component={MainVideo}
        durationInFrames={460}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          brandName: "Jouw studio",
          tagline: "Websites die verkopen",
        }}
      />
    </>
  );
};
