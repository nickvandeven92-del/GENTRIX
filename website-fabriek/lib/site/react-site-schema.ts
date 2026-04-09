import { z } from "zod";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Verwacht #RRGGBB");

const hrefSchema = z.string().min(1).max(800);

const linkSchema = z.object({
  label: z.string().min(1).max(200),
  href: hrefSchema,
});

/** Subitems onder een nav-dropdown (alleen labels + href). */
const navMenuChildSchema = z.object({
  label: z.string().min(1).max(200),
  href: hrefSchema,
});

/** Topniveau nav: platte link óf dropdown met \`children\` (dan is \`href\` optioneel). */
const navMenuLinkSchema = z
  .object({
    label: z.string().min(1).max(200),
    href: hrefSchema.optional(),
    children: z.array(navMenuChildSchema).min(1).max(16).optional(),
  })
  .superRefine((val, ctx) => {
    const hasChildren = val.children != null && val.children.length > 0;
    if (!hasChildren && (val.href == null || val.href.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nav link: href is verplicht tenzij children (dropdown) is gezet",
        path: ["href"],
      });
    }
  });

const studioVisibilitySchema = z.enum(["public", "portal"]).optional();

const navOverlaySectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("nav_overlay"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    logoText: z.string().min(1).max(120),
    links: z.array(navMenuLinkSchema).max(12),
    /**
     * `floating` = zwevende pill (glass) over hero — goed op donkere/cinematic heroes.
     * `bar_light` / `bar_dark` = volle breedte, sticky balk — beter bij lichte pagina’s en strakke fonts.
     */
    barStyle: z.enum(["floating", "bar_light", "bar_dark"]).optional(),
  }),
});

const heroCinematicSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("hero_cinematic"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    eyebrow: z.string().max(200).optional(),
    headline: z.string().min(1).max(300),
    headlineAccent: z.string().max(200).optional(),
    subhead: z.string().max(600).optional(),
    videoUrl: z.string().url().max(800).optional(),
    posterUrl: z.string().url().max(800).optional(),
    ctaPrimary: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
    ctaSecondary: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
    /** `neon`: gecentreerde cyber/stoere look — gradient-kop, grid, gloed-knoppen (Lovable-achtig). Default: filmische hero onderaan. */
    visualTone: z.enum(["cinematic", "neon"]).optional(),
    /** Alleen bij `visualTone: neon`: subtiele scroll-hint onderaan. */
    showScrollHint: z.boolean().optional(),
  }),
});

const featureCardIconKeySchema = z.enum([
  "scissors",
  "sparkles",
  "crown",
  "zap",
  "map_pin",
  "clock",
  "phone",
  "instagram",
  "star",
  "layout_grid",
  "user",
]);

const featureCardsSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("feature_cards"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    titleAccent: z.string().max(120).optional(),
    intro: z.string().max(500).optional(),
    columns: z.enum(["2", "3"]).optional(),
    items: z
      .array(
        z.object({
          icon: featureCardIconKeySchema.optional(),
          title: z.string().min(1).max(120),
          body: z.string().min(1).max(500),
          price: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
});

const statsStripSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("stats_strip"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    items: z
      .array(
        z.object({
          value: z.string().min(1).max(40),
          label: z.string().min(1).max(120),
        }),
      )
      .min(1)
      .max(4),
  }),
});

const faqAccordionSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("faq_accordion"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    intro: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(300),
          answer: z.string().min(1).max(2000),
        }),
      )
      .min(1)
      .max(12),
  }),
});

const testimonialGridSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("testimonial_grid"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    columns: z.enum(["2", "3"]).optional(),
    items: z
      .array(
        z.object({
          quote: z.string().min(1).max(800),
          author: z.string().min(1).max(120),
          role: z.string().max(120).optional(),
          rating: z.number().int().min(1).max(5).optional(),
        }),
      )
      .min(1)
      .max(9),
  }),
});

const pricingCardsSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("pricing_cards"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    intro: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          price: z.string().min(1).max(40),
          period: z.string().max(40).optional(),
          description: z.string().max(400).optional(),
          features: z.array(z.string().min(1).max(200)).max(10).optional(),
          highlighted: z.boolean().optional(),
          cta: z.object({ label: z.string().min(1).max(80), href: hrefSchema }),
        }),
      )
      .min(1)
      .max(4),
  }),
});

const logoCloudSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("logo_cloud"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().max(200).optional(),
    logos: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          imageUrl: z.string().url().max(800).optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
});

const galleryGridSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("gallery_grid"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().max(200).optional(),
    columns: z.enum(["2", "3", "4"]).optional(),
    images: z
      .array(
        z.object({
          url: z.string().url().max(800),
          alt: z.string().max(200).optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
});

const timelineSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("timeline"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    intro: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          date: z.string().max(80).optional(),
          title: z.string().min(1).max(200),
          body: z.string().min(1).max(800),
        }),
      )
      .min(1)
      .max(8),
  }),
});

const featureListSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("feature_list"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    intro: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          icon: featureCardIconKeySchema.optional(),
          title: z.string().min(1).max(120),
          body: z.string().min(1).max(500),
        }),
      )
      .min(1)
      .max(10),
  }),
});

const bentoGridSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("bento_grid"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    intro: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          title: z.string().min(1).max(120),
          body: z.string().min(1).max(400),
          span: z.enum(["1x1", "2x1", "1x2", "2x2"]).optional(),
          icon: featureCardIconKeySchema.optional(),
        }),
      )
      .min(1)
      .max(8),
  }),
});

const ctaBlockSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("cta_block"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    variant: z.enum(["centered", "split", "minimal", "overlay"]).optional(),
    title: z.string().min(1).max(300),
    body: z.string().max(600).optional(),
    primary: z.object({ label: z.string().min(1).max(80), href: hrefSchema }),
    secondary: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
    backgroundImageUrl: z.string().url().max(800).optional(),
  }),
});

const splitContentSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("split_content"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    title: z.string().min(1).max(300),
    body: z.string().min(1).max(4000),
    imageUrl: z.string().url().max(800).optional(),
    imageAlt: z.string().max(200).optional(),
    imagePosition: z.enum(["left", "right"]).optional(),
    bullets: z
      .array(
        z.object({
          title: z.string().max(120),
          body: z.string().max(400),
        }),
      )
      .max(8)
      .optional(),
  }),
});

const ctaBandSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("cta_band"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    variant: z.enum(["dark", "light"]).optional(),
    title: z.string().min(1).max(300),
    body: z.string().max(600).optional(),
    primary: z.object({ label: z.string().max(80), href: hrefSchema }),
    secondary: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
  }),
});

const footerMinimalSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("footer_minimal"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    brand: z.string().min(1).max(120),
    tagline: z.string().max(300).optional(),
    columns: z
      .array(
        z.object({
          title: z.string().max(80),
          links: z.array(linkSchema).max(16),
        }),
      )
      .max(4)
      .optional(),
    legal: z.string().max(500).optional(),
  }),
});

const fullBleedSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("full_bleed"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    imageUrl: z.string().url().max(800).optional(),
    videoUrl: z.string().url().max(800).optional(),
    posterUrl: z.string().url().max(800).optional(),
    alt: z.string().max(200).optional(),
    minHeight: z.enum(["half", "large", "screen"]).optional(),
    overlay: z.enum(["none", "light", "medium", "heavy"]).optional(),
    captionTitle: z.string().max(300).optional(),
    captionBody: z.string().max(600).optional(),
  }),
});

const statementSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("statement"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    kicker: z.string().max(120).optional(),
    headline: z.string().min(1).max(400),
    headlineAccent: z.string().max(200).optional(),
    subline: z.string().max(800).optional(),
    align: z.enum(["center", "left"]).optional(),
    variant: z.enum(["light", "dark"]).optional(),
    cta: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
  }),
});

const closingSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal("closing"),
  studioVisibility: studioVisibilitySchema,
  props: z.object({
    eyebrow: z.string().max(200).optional(),
    title: z.string().min(1).max(300),
    body: z.string().max(600).optional(),
    primary: z.object({ label: z.string().max(80), href: hrefSchema }),
    secondary: z.object({ label: z.string().max(80), href: hrefSchema }).optional(),
    variant: z.enum(["dark", "light"]).optional(),
    backgroundImageUrl: z.string().url().max(800).optional(),
  }),
});

export const reactSiteSectionSchema = z.discriminatedUnion("type", [
  navOverlaySectionSchema,
  heroCinematicSectionSchema,
  fullBleedSectionSchema,
  statementSectionSchema,
  splitContentSectionSchema,
  closingSectionSchema,
  ctaBandSectionSchema,
  ctaBlockSectionSchema,
  footerMinimalSectionSchema,
  featureCardsSectionSchema,
  statsStripSectionSchema,
  faqAccordionSectionSchema,
  testimonialGridSectionSchema,
  pricingCardsSectionSchema,
  logoCloudSectionSchema,
  galleryGridSectionSchema,
  timelineSectionSchema,
  featureListSectionSchema,
  bentoGridSectionSchema,
]);

export type ReactSiteSection = z.infer<typeof reactSiteSectionSchema>;

export const reactSiteDocumentSchema = z
  .object({
    format: z.literal("react_sections"),
    schemaVersion: z.literal(1),
    documentTitle: z.string().min(1).max(120).optional(),
    theme: z.object({
      primary: hex,
      accent: hex,
      background: hex,
      foreground: hex,
      mutedForeground: hex.optional(),
      fontSans: z.string().max(200).optional(),
      fontSerif: z.string().max(200).optional(),
    }),
    sections: z.array(reactSiteSectionSchema).min(1).max(32),
  })
  .strict();

export type ReactSiteDocument = z.infer<typeof reactSiteDocumentSchema>;

export function parseReactSiteDocument(input: unknown): ReactSiteDocument | null {
  const r = reactSiteDocumentSchema.safeParse(input);
  return r.success ? r.data : null;
}
