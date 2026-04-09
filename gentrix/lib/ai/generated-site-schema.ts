import { z } from "zod";

const navLink = z.object({ label: z.string(), href: z.string() });

export const navigationSchema = z.object({
  brandName: z.string(),
  logoImageUrl: z.string().optional(),
  /** Eén letter als er geen logo-URL is (bijv. "K") */
  logoLetter: z.string().max(2).optional(),
  links: z.array(navLink),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
});

/** Sectie-types voor productie-waardige landingspagina's (o.a. kappers / barbier). */
export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("hero"),
    eyebrow: z.string().optional(),
    badge: z.string().optional(),
    headline: z.string(),
    subheadline: z.string().optional(),
    /** Volbreed achtergrondbeeld (https URL, bv. Unsplash) */
    backgroundImageUrl: z.string().optional(),
    /** Optioneel beeld naast tekst op desktop */
    sideImageUrl: z.string().optional(),
    /** Donkere overlay boven bg-foto 0–1 (hoger = meer contrast voor tekst) */
    overlayOpacity: z.number().min(0).max(1).optional(),
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
    secondaryCtaLabel: z.string().optional(),
    secondaryCtaHref: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("stats"),
    items: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal("features"),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    items: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal("gallery"),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    images: z.array(
      z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string().optional(),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal("steps"),
    title: z.string(),
    subtitle: z.string().optional(),
    items: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal("testimonials"),
    title: z.string().optional(),
    items: z.array(
      z.object({
        quote: z.string(),
        name: z.string(),
        role: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
      }),
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal("appointment"),
    title: z.string(),
    description: z.string().optional(),
    primaryButtonLabel: z.string(),
    primaryButtonHref: z.string(),
    secondaryLabel: z.string().optional(),
    secondaryHref: z.string().optional(),
    footnote: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("cta"),
    headline: z.string(),
    subtext: z.string().optional(),
    buttonLabel: z.string(),
    buttonHref: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("footer"),
    companyName: z.string(),
    tagline: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    openingHours: z.string().optional(),
    columns: z
      .array(
        z.object({
          title: z.string(),
          links: z.array(navLink),
        }),
      )
      .optional(),
    instagramUrl: z.string().optional(),
    facebookUrl: z.string().optional(),
    tiktokUrl: z.string().optional(),
  }),
]);

export const generatedSiteSchema = z.object({
  meta: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
  /** Vaste navbar: merk, menu, optionele CTA */
  navigation: navigationSchema.optional(),
  theme: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string(),
    foreground: z.string(),
    surface: z.string().optional(),
    muted: z.string().optional(),
    heroGradientFrom: z.string().optional(),
    heroGradientTo: z.string().optional(),
  }),
  sections: z.array(sectionSchema).min(1),
});

export type GeneratedSite = z.infer<typeof generatedSiteSchema>;
export type GeneratedSection = z.infer<typeof sectionSchema>;
export type SiteNavigation = z.infer<typeof navigationSchema>;
