import { z } from "zod";

/** Bekende layout-preset id’s — uitbreiden bewust via enum. */
export const LAYOUT_PRESET_IDS = ["default", "marketing-standard", "editorial-wide", "portal-mock"] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const layoutPresetIdSchema = z.enum(LAYOUT_PRESET_IDS);

export const CONTENT_DENSITY_VALUES = ["compact", "normal", "relaxed", "generous"] as const;

export type ContentDensity = (typeof CONTENT_DENSITY_VALUES)[number];

export const contentDensitySchema = z.enum(CONTENT_DENSITY_VALUES);
