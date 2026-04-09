import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const Scene4Precision: FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 40], [0.92, 1], { extrapolateRight: "clamp" });
  const ring = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ zIndex: 2, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: `3px solid rgba(167, 139, 250, ${0.3 + ring * 0.5})`,
          boxShadow: `0 0 ${60 + ring * 80}px rgba(167, 139, 250, ${0.25 + ring * 0.35})`,
          transform: `scale(${scale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 38,
            fontWeight: 600,
            color: "#e2e8f0",
            lineHeight: 1.4,
            maxWidth: 280,
          }}
        >
          Elk frame
          <br />
          <span style={{ color: "#a78bfa" }}>met intentie</span>
        </p>
      </div>
    </AbsoluteFill>
  );
};
