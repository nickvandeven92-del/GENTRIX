import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { brandName: string; tagline: string };

export const Scene1Intro: FC<Props> = ({ brandName, tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = spring({ frame, fps, config: { damping: 18 } });
  const subOp = spring({ frame: frame - 8, fps, config: { damping: 20 } });
  const y = interpolate(spring({ frame, fps, config: { damping: 16 } }), [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ zIndex: 2, justifyContent: "center", alignItems: "center" }}>
      <h1
        style={{
          margin: 0,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: "#f8fafc",
          opacity: titleOp,
          transform: `translateY(${y}px)`,
          textAlign: "center",
          maxWidth: 1600,
          lineHeight: 1.05,
        }}
      >
        {brandName}
      </h1>
      <p
        style={{
          marginTop: 28,
          fontSize: 36,
          fontWeight: 500,
          color: "#94a3b8",
          opacity: subOp,
          textAlign: "center",
        }}
      >
        {tagline}
      </p>
    </AbsoluteFill>
  );
};
