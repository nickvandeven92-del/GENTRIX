import { z } from "zod";

/** Paginacontext voor kwaliteit / rollen (landing vs juridisch, enz.). */
export const SNAPSHOT_PAGE_TYPES = ["landing", "legal", "article", "generic"] as const;
export type SnapshotPageType = (typeof SNAPSHOT_PAGE_TYPES)[number];

export const snapshotPageTypeSchema = z.enum(SNAPSHOT_PAGE_TYPES);

export function getEffectivePageType(pageType: SnapshotPageType | undefined): SnapshotPageType {
  return pageType ?? "landing";
}
