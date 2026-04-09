import type { FC } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const ITEMS = ["Strategie & positionering", "Design & build", "Lancering & groei"];

export const Scene3Services: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ zIndex: 2, justifyContent: "center", paddingLeft: 140, paddingRight: 140 }}>
      <p
        style={{
          margin: "0 0 32px 0",
          fontSize: 22,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "#38bdf8",
        }}
      >
        Wat we doen
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {ITEMS.map((label, i) => {
          const delay = i * 10;
          const op = spring({ frame: frame - delay, fps, config: { damping: 22 } });
          const x = interpolate(op, [0, 1], [-24, 0]);
          return (
            <li
              key={label}
              style={{
                fontSize: 52,
                fontWeight: 600,
                color: "#f1f5f9",
                marginBottom: 28,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              {label}
            </li>
          );
        })}
      </ul>
    </AbsoluteFill>
  );
};
