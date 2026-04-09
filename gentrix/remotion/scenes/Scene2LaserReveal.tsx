import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Horizontale licht-scan + titel. */
export const Scene2LaserReveal: FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 45], [-30, 110], { extrapolateRight: "clamp" });
  const glow = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ zIndex: 2, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          left: `${sweep}%`,
          top: "35%",
          width: "8%",
          height: "30%",
          transform: "translateX(-50%) skewX(-12deg)",
          background: `linear-gradient(90deg, transparent, rgba(56, 189, 248, ${0.2 + glow * 0.5}), transparent)`,
          boxShadow: `0 0 ${40 + glow * 40}px rgba(56, 189, 248, ${0.4 + glow * 0.4})`,
        }}
      />
      <h2
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 700,
          color: "#e2e8f0",
          opacity: titleOp,
          letterSpacing: "-0.03em",
        }}
      >
        Precisie · snelheid · kwaliteit
      </h2>
    </AbsoluteFill>
  );
};
