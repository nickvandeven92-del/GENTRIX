import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Compact schaar-mark voor navbar / hero (warm barbier‑branding, geen emoji). */
export function BarberMark({
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      className={cn("shrink-0", className)}
      style={style}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <path
        d="M9.5 7.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5-3.5-1.567-3.5-3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 24.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5-3.5-1.567-3.5-3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m26 5-9.5 9.5M26 27 16.5 17.5M14.5 15.5 6 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BarberOrnament({
  className,
  accentVar = "--site-primary",
}: {
  className?: string;
  /** CSS custom property voor goud/accent (bijv. `--rs-accent` in cinematic sites). */
  accentVar?: string;
}) {
  const line: CSSProperties = { backgroundColor: `color-mix(in srgb, var(${accentVar}) 72%, transparent)` };
  const icon: CSSProperties = { color: `var(${accentVar})` };
  return (
    <div className={cn("flex items-center gap-0", className)} aria-hidden>
      <span className="h-px flex-1 max-w-[3.5rem]" style={line} />
      <BarberMark className="mx-3 h-7 w-7 md:h-8 md:w-8" style={icon} />
      <span className="h-px flex-1 max-w-[3.5rem]" style={line} />
    </div>
  );
}
