import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { CinematicHero } from "@/components/site/react-site/cinematic/CinematicHero";
import { CinematicNav } from "@/components/site/react-site/cinematic/CinematicNav";
import { BentoGridSection } from "@/components/site/react-site/cinematic/BentoGridSection";
import { ClosingSection } from "@/components/site/react-site/cinematic/ClosingSection";
import { CtaBlockSection } from "@/components/site/react-site/cinematic/CtaBlockSection";
import { FaqAccordionSection } from "@/components/site/react-site/cinematic/FaqAccordionSection";
import { FeatureCardsSection } from "@/components/site/react-site/cinematic/FeatureCardsSection";
import { FeatureListSection } from "@/components/site/react-site/cinematic/FeatureListSection";
import { FullBleedSection } from "@/components/site/react-site/cinematic/FullBleedSection";
import { GalleryGridSection } from "@/components/site/react-site/cinematic/GalleryGridSection";
import { LogoCloudSection } from "@/components/site/react-site/cinematic/LogoCloudSection";
import { PricingCardsSection } from "@/components/site/react-site/cinematic/PricingCardsSection";
import { StatementSection } from "@/components/site/react-site/cinematic/StatementSection";
import { StatsStripSection } from "@/components/site/react-site/cinematic/StatsStripSection";
import { TestimonialGridSection } from "@/components/site/react-site/cinematic/TestimonialGridSection";
import { TimelineSection } from "@/components/site/react-site/cinematic/TimelineSection";
import { cx, type ResolveHref } from "@/components/site/react-site/cinematic/types";

export { type ResolveHref } from "@/components/site/react-site/cinematic/types";

export function ReactSiteSectionView({
  section,
  accentVar,
  resolveHref = (h) => h,
  fixedNavOverlapClass = "",
  embedded = false,
}: {
  section: ReactSiteSection;
  accentVar: string;
  resolveHref?: ResolveHref;
  /** Zie `classForFixedNavOverlap` — extra ruimte onder vaste nav-pill. */
  fixedNavOverlapClass?: string;
  /** Studio/iframe: nav `fixed` klemt niet goed — doorgeven aan `CinematicNav`. */
  embedded?: boolean;
}) {
  switch (section.type) {
    case "nav_overlay":
      return <CinematicNav section={section} resolveHref={resolveHref} embedded={embedded} />;
    case "hero_cinematic":
      return <CinematicHero section={section} accentVar={accentVar} resolveHref={resolveHref} />;
    case "full_bleed":
      return <FullBleedSection section={section} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "statement":
      return (
        <StatementSection
          section={section}
          accentVar={accentVar}
          resolveHref={resolveHref}
          fixedNavOverlapClass={fixedNavOverlapClass}
        />
      );
    case "split_content":
      return <SplitContent section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "closing":
      return (
        <ClosingSection
          section={section}
          accentVar={accentVar}
          resolveHref={resolveHref}
          fixedNavOverlapClass={fixedNavOverlapClass}
        />
      );
    case "cta_band":
      return (
        <CtaBand
          section={section}
          accentVar={accentVar}
          resolveHref={resolveHref}
          fixedNavOverlapClass={fixedNavOverlapClass}
        />
      );
    case "cta_block":
      return (
        <CtaBlockSection
          section={section}
          accentVar={accentVar}
          resolveHref={resolveHref}
          fixedNavOverlapClass={fixedNavOverlapClass}
        />
      );
    case "footer_minimal":
      return <FooterMinimal section={section} resolveHref={resolveHref} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "feature_cards":
      return (
        <FeatureCardsSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />
      );
    case "stats_strip":
      return <StatsStripSection section={section} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "faq_accordion":
      return (
        <FaqAccordionSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />
      );
    case "testimonial_grid":
      return (
        <TestimonialGridSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />
      );
    case "pricing_cards":
      return (
        <PricingCardsSection
          section={section}
          accentVar={accentVar}
          resolveHref={resolveHref}
          fixedNavOverlapClass={fixedNavOverlapClass}
        />
      );
    case "logo_cloud":
      return <LogoCloudSection section={section} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "gallery_grid":
      return <GalleryGridSection section={section} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "timeline":
      return <TimelineSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />;
    case "feature_list":
      return (
        <FeatureListSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />
      );
    case "bento_grid":
      return <BentoGridSection section={section} accentVar={accentVar} fixedNavOverlapClass={fixedNavOverlapClass} />;
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function SplitContent({
  section,
  accentVar,
  fixedNavOverlapClass = "",
}: {
  section: Extract<ReactSiteSection, { type: "split_content" }>;
  accentVar: string;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const imgFirst = (p.imagePosition ?? "left") === "left";
  const textBlock = (
    <div className="flex flex-col justify-center">
      {p.kicker ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
      ) : null}
      <h2 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">{p.title}</h2>
      <p className="mt-6 text-lg leading-relaxed text-zinc-600">{p.body}</p>
      {p.bullets?.length ? (
        <ul className="mt-10 space-y-8">
          {p.bullets.map((b, i) => (
            <li key={i}>
              <FadeUpItem index={i} className="flex gap-4">
                <span
                  className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
                  style={{ borderColor: `var(${accentVar})`, color: `var(${accentVar})` }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-zinc-900">{b.title}</p>
                  <p className="mt-1 text-zinc-600">{b.body}</p>
                </div>
              </FadeUpItem>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
  const media = p.imageUrl ? (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 shadow-xl lg:aspect-auto lg:min-h-[420px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.imageUrl} alt={p.imageAlt ?? ""} className="h-full w-full object-cover" />
    </div>
  ) : null;
  return (
    <section
      id={section.id}
      className={cn("bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28", fixedNavOverlapClass)}
    >
      <FadeUp>
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {imgFirst ? (
            <>
              {media}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {media}
            </>
          )}
        </div>
      </FadeUp>
    </section>
  );
}

function CtaBand({
  section,
  accentVar,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Extract<ReactSiteSection, { type: "cta_band" }>;
  accentVar: string;
  resolveHref: ResolveHref;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const dark = p.variant !== "light";
  return (
    <section
      id={section.id}
      className={cn(
        cx(
          "px-6 py-20 sm:px-10 lg:px-16 lg:py-24",
          dark ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900",
        ),
        fixedNavOverlapClass,
      )}
    >
      <FadeUp>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{p.title}</h2>
            {p.body ? (
              <p className={cx("mt-4 text-lg", dark ? "text-white/75" : "text-zinc-600")}>{p.body}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:justify-end">
            <a
              href={resolveHref(p.primary.href)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md"
              style={{ backgroundColor: `var(${accentVar})` }}
            >
              <Mail className="h-4 w-4" aria-hidden />
              {p.primary.label}
            </a>
            {p.secondary ? (
              <a
                href={resolveHref(p.secondary.href)}
                className={cx(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold",
                  dark ? "border-white/30 text-white hover:bg-white/10" : "border-zinc-300 text-zinc-900 hover:bg-zinc-100",
                )}
              >
                <Phone className="h-4 w-4" aria-hidden />
                {p.secondary.label}
              </a>
            ) : null}
          </div>
        </div>
      </FadeUp>
    </section>
  );
}

function FooterMinimal({
  section,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Extract<ReactSiteSection, { type: "footer_minimal" }>;
  resolveHref: ResolveHref;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  return (
    <footer
      id={section.id}
      className={cn("border-t border-zinc-200 bg-white px-6 py-16 text-zinc-800 sm:px-10 lg:px-16", fixedNavOverlapClass)}
    >
      <FadeUp>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
            <div>
              <p className="font-serif text-xl font-semibold text-zinc-900">{p.brand}</p>
              {p.tagline ? <p className="mt-2 max-w-sm text-sm text-zinc-600">{p.tagline}</p> : null}
            </div>
            {p.columns?.length ? (
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {p.columns.map((col, colIdx) => (
                  <FadeUpItem key={col.title} index={colIdx}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{col.title}</p>
                      <ul className="mt-4 space-y-2">
                        {col.links.map((l) => (
                          <li key={l.href + l.label}>
                            <a href={resolveHref(l.href)} className="text-sm text-zinc-700 hover:text-zinc-900">
                              {l.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </FadeUpItem>
                ))}
              </div>
            ) : null}
          </div>
          {p.legal ? <p className="mt-12 border-t border-zinc-100 pt-8 text-center text-xs text-zinc-500">{p.legal}</p> : null}
        </div>
      </FadeUp>
    </footer>
  );
}
