import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Subtiele bewegende gradient op de volledige timeline. */
export const PersistentBackground: FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 300], [0, 360], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill style={{ zIndex: 0, pointerEvents: "none" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(${shift}deg, #0f172a 0%, #1e1b4b 40%, #0c4a6e 100%)`,
          opacity: 0.95,
        }}
      />
    </AbsoluteFill>
  );
};
