import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { brandName: string };

export const Scene5Outro: FC<Props> = ({ brandName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = spring({ frame, fps, config: { damping: 20 } });
  const ctaOp = spring({ frame: frame - 12, fps, config: { damping: 22 } });

  const urlOp = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ zIndex: 2, justifyContent: "center", alignItems: "center" }}>
      <p style={{ margin: 0, fontSize: 28, color: "#94a3b8", opacity: op }}>Klaar om te gaan?</p>
      <h2
        style={{
          margin: "20px 0 0 0",
          fontSize: 84,
          fontWeight: 800,
          color: "#f8fafc",
          opacity: ctaOp,
          letterSpacing: "-0.03em",
        }}
      >
        {brandName}
      </h2>
      <p
        style={{
          marginTop: 32,
          fontSize: 30,
          fontWeight: 500,
          color: "#38bdf8",
          opacity: urlOp,
        }}
      >
        Jouw merk · jouw site
      </p>
    </AbsoluteFill>
  );
};
