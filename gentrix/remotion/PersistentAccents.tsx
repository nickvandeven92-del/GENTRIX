import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const PersistentAccents: FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 20), [-1, 1], [0.15, 0.45]);

  return (
    <AbsoluteFill style={{ zIndex: 1, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 50% at 80% 20%, rgba(56, 189, 248, ${pulse}) 0%, transparent 55%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 10% 80%, rgba(167, 139, 250, ${pulse * 0.8}) 0%, transparent 50%)`,
        }}
      />
    </AbsoluteFill>
  );
};
