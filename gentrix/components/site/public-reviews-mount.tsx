"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Review } from "../../frontends/gentrix-review-display-main/src/components/ReviewStrip";
import { ReviewStrip } from "../../frontends/gentrix-review-display-main/src/components/ReviewStrip";

type Props = {
  targetId: string;
  reviews: Review[];
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
  layout?: "strip" | "grid";
  maxReviews?: 3 | 4 | 6;
};

export function PublicReviewsMount({
  targetId,
  reviews,
  accentColor,
  borderColor = "#e5e7eb",
  borderRadius = "12px",
  layout = "strip",
  maxReviews = 4,
}: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setTarget(document.getElementById(targetId));
    return () => setTarget(null);
  }, [targetId]);

  if (!target) return null;

  return createPortal(
    <ReviewStrip
      reviews={reviews}
      maxReviews={maxReviews}
      accentColor={accentColor}
      borderColor={borderColor}
      borderRadius={borderRadius}
      layout={layout}
    />,
    target,
  );
}
