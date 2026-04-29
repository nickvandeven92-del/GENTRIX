"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  SocialGallery,
  type SocialGalleryLayout,
  type SocialPhoto,
} from "../../frontends/gentrix-photo-grid-main/src/components/SocialGallery";

type Props = {
  targetId: string;
  photos: SocialPhoto[];
  layout: SocialGalleryLayout;
};

export function PublicSocialGalleryMount({ targetId, photos, layout }: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setTarget(document.getElementById(targetId));
    return () => setTarget(null);
  }, [targetId]);

  if (!target) return null;

  return createPortal(<SocialGallery photos={photos} layout={layout} />, target);
}
