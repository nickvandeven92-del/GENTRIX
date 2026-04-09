import { z } from "zod";

/**
 * Alleen deze sleutels mogen in theme.tokenOverrides (geen vrije zooi).
 * Uitbreiden = expliciete enum-uitbreiding + migratie.
 */
export const TOKEN_OVERRIDE_KEYS = [
  "color.primary",
  "color.accent",
  "surface.base",
  "surface.elevated",
  "text.primary",
  "text.muted",
  "radius.card",
  "shadow.soft",
  "spacing.sectionY",
  "layout.mobile",
  "cta.intent",
  "hero.tone",
] as const;

export type TokenOverrideKey = (typeof TOKEN_OVERRIDE_KEYS)[number];

export const tokenOverrideKeySchema = z.enum(TOKEN_OVERRIDE_KEYS);

const tokenOverrideValueSchema = z.string().min(1).max(500);

function keysAreAllowedTokenOverrides(r: Record<string, string>): boolean {
  return Object.keys(r).every((k) => (TOKEN_OVERRIDE_KEYS as readonly string[]).includes(k));
}

/**
 * Sparse record: alleen subset van keys aanwezig. Zod 4 `z.record(enum, val)` zou álle keys verplichten.
 */
export const tokenOverridesRecordSchema = z
  .record(z.string(), tokenOverrideValueSchema)
  .refine(keysAreAllowedTokenOverrides, { message: "tokenOverrides: onbekende key" })
  .default({});

/** Alleen voor AI/patch: subset van keys, max 48 entries. */
export const tokenOverridesPatchSchema = z
  .record(z.string(), tokenOverrideValueSchema)
  .refine(keysAreAllowedTokenOverrides, { message: "tokenOverrides: onbekende key" })
  .refine((r) => Object.keys(r).length <= 48, { message: "Maximaal 48 tokenOverrides" });
