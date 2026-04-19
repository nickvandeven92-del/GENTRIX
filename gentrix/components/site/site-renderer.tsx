import type { GeneratedSection, GeneratedSite } from "@/lib/ai/generated-site-schema";
import { BarberOrnament } from "@/components/site/barber-mark";
import { SiteNav } from "@/components/site/site-nav";
import { SiteRemoteImage } from "@/components/site/site-remote-image";
import { cn } from "@/lib/utils";

type SiteRendererProps = {
  data: GeneratedSite;
  className?: string;
};

function StarRow({ rating }: { rating: number }) {
  const r = Math.round(Math.min(5, Math.max(1, rating)));
  return (
    <p className="text-amber-400" aria-hidden>
      {"★".repeat(r)}
      <span className="text-[var(--site-fg)]/25">{"★".repeat(5 - r)}</span>
    </p>
  );
}

/**
 * Publieke landingspagina met navbar, hero met foto’s, galerij en barbier-stijl footer.
 */
export function SiteRenderer({ data, className }: SiteRendererProps) {
  const { theme, sections } = data;
  const surface = theme.surface ?? theme.background;
  const gFrom = theme.heroGradientFrom ?? theme.primary;
  const gTo = theme.heroGradientTo ?? theme.secondary ?? theme.primary;

  const cssVars = {
    "--site-primary": theme.primary,
    "--site-secondary": theme.secondary ?? theme.primary,
    "--site-accent": theme.accent ?? theme.primary,
    "--site-bg": theme.background,
    "--site-fg": theme.foreground,
    "--site-surface": surface,
    ...(theme.muted ? { "--site-muted": theme.muted } : {}),
    "--hero-from": gFrom,
    "--hero-to": gTo,
  } as React.CSSProperties;

  return (
    <div className={className} style={cssVars}>
      <div className="min-h-full bg-[var(--site-bg)] text-[var(--site-fg)] antialiased selection:bg-[var(--site-primary)]/25">
        <SiteNav site={data} />
        <main>
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </main>
      </div>
    </div>
  );
}

function SectionBlock({ section }: { section: GeneratedSection }) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} />;
    case "stats":
      return (
        <section
          id={section.id}
          className="border-y border-[var(--site-fg)]/10 px-6 py-12 backdrop-blur-sm [background:color-mix(in_srgb,var(--site-surface)_92%,var(--site-bg))]"
        >
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
            {section.items.map((item, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold tabular-nums text-[var(--site-primary)] md:text-4xl">{item.value}</p>
                <p className="mt-1 text-sm text-[var(--site-fg)]/65">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "features":
      return (
        <section id={section.id} className="px-6 py-20 md:py-24">
          <div className="mx-auto max-w-6xl">
            {(section.title || section.subtitle) && (
              <div className="mx-auto mb-14 max-w-2xl text-center">
                {section.title && (
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--site-fg)] md:text-4xl">{section.title}</h2>
                )}
                {section.subtitle && (
                  <p className="mt-4 text-lg text-[var(--site-fg)]/70">{section.subtitle}</p>
                )}
              </div>
            )}
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item, i) => (
                <li
                  key={`${section.id}-${i}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--site-fg)]/10 bg-[var(--site-surface)] shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--site-primary)]/10"
                >
                  {item.imageUrl && (
                    <div className="relative aspect-[16/10] w-full">
                      <SiteRemoteImage
                        src={item.imageUrl}
                        alt=""
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width:768px) 100vw, 33vw"
                      />
                    </div>
                  )}
                  <div className="p-8">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--site-primary)]/30 bg-gradient-to-br from-[var(--site-primary)]/22 to-[var(--site-accent)]/12 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/5">
                      {item.icon ? (
                        <span className="drop-shadow-sm" aria-hidden>
                          {item.icon}
                        </span>
                      ) : (
                        <span className="font-serif text-xl font-bold text-[var(--site-primary)]">{item.title.charAt(0)}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--site-fg)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--site-fg)]/70">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );

    case "gallery":
      return (
        <section id={section.id} className="bg-[var(--site-fg)]/[0.04] px-6 py-20 md:py-28">
          <div className="mx-auto max-w-6xl">
            {(section.title || section.subtitle) && (
              <div className="mx-auto mb-12 max-w-2xl text-center">
                {section.title && (
                  <h2 className="font-serif text-3xl font-bold text-[var(--site-fg)] md:text-4xl">{section.title}</h2>
                )}
                {section.subtitle && <p className="mt-3 text-lg text-[var(--site-fg)]/65">{section.subtitle}</p>}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.images.map((img, i) => (
                <figure
                  key={i}
                  className="group overflow-hidden rounded-2xl border border-[var(--site-fg)]/10 bg-[var(--site-surface)] shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <SiteRemoteImage
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-105"
                      sizes="(max-width:1024px) 100vw, 33vw"
                    />
                  </div>
                  {img.caption && (
                    <figcaption className="border-t border-[var(--site-fg)]/10 px-4 py-3 text-center text-sm text-[var(--site-fg)]/70">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      );

    case "steps":
      return (
        <section
          id={section.id}
          className="px-6 py-20 [background:color-mix(in_srgb,var(--site-primary)_6%,var(--site-bg))] md:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-[var(--site-fg)] md:text-4xl">{section.title}</h2>
              {section.subtitle && <p className="mt-3 text-lg text-[var(--site-fg)]/70">{section.subtitle}</p>}
            </div>
            <ol className="space-y-8">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--site-primary)] to-[var(--site-accent)] text-lg font-bold text-white shadow-md">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--site-fg)]">{item.title}</h3>
                    <p className="mt-1 text-[var(--site-fg)]/70">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section id={section.id} className="px-6 py-20 md:py-24">
          <div className="mx-auto max-w-6xl">
            {section.title && (
              <h2 className="mb-12 text-center font-serif text-3xl font-bold text-[var(--site-fg)] md:text-4xl">
                {section.title}
              </h2>
            )}
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="flex flex-col rounded-2xl border border-[var(--site-fg)]/10 bg-[var(--site-surface)] p-6 shadow-sm"
                >
                  {item.rating != null && (
                    <div className="mb-3">
                      <StarRow rating={item.rating} />
                    </div>
                  )}
                  <blockquote className="flex-1 text-[var(--site-fg)]/90">&ldquo;{item.quote}&rdquo;</blockquote>
                  <footer className="mt-6 border-t border-[var(--site-fg)]/10 pt-4">
                    <p className="font-semibold text-[var(--site-fg)]">{item.name}</p>
                    {item.role && <p className="text-sm text-[var(--site-fg)]/60">{item.role}</p>}
                  </footer>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );

    case "appointment":
      return (
        <section id={section.id} className="scroll-mt-20 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--site-primary)]/25 bg-gradient-to-br from-[var(--site-surface)] to-[var(--site-bg)] p-1 shadow-2xl shadow-[var(--site-primary)]/15">
              <div className="rounded-[1.4rem] bg-[var(--site-surface)]/95 px-8 py-12 text-center md:px-12 md:py-14">
                <h2 className="text-2xl font-bold text-[var(--site-fg)] md:text-3xl">{section.title}</h2>
                {section.description && (
                  <p className="mx-auto mt-4 max-w-lg text-[var(--site-fg)]/75">{section.description}</p>
                )}
                <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
                  <a
                    href={section.primaryButtonHref}
                    className="inline-flex items-center justify-center rounded-2xl bg-[var(--site-primary)] px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                  >
                    {section.primaryButtonLabel}
                  </a>
                  {section.secondaryLabel && (
                    <a
                      href={section.secondaryHref ?? "#"}
                      className="inline-flex items-center justify-center rounded-2xl border border-[var(--site-fg)]/15 px-8 py-4 text-sm font-semibold text-[var(--site-fg)] transition hover:bg-[var(--site-fg)]/5"
                    >
                      {section.secondaryLabel}
                    </a>
                  )}
                </div>
                {section.footnote && (
                  <p className="mt-6 text-xs text-[var(--site-fg)]/55">{section.footnote}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      );

    case "cta":
      return (
        <section id={section.id} className="px-6 py-16">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--site-primary)] via-[var(--site-primary)] to-[var(--site-accent)] p-[1px] shadow-xl">
            <div className="rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-[var(--site-primary)] to-[var(--site-accent)] px-8 py-14 text-center text-white md:px-12">
              <h2 className="text-2xl font-bold md:text-3xl">{section.headline}</h2>
              {section.subtext && <p className="mt-4 text-lg text-white/90">{section.subtext}</p>}
              <a
                href={section.buttonHref ?? "#"}
                className="mt-8 inline-flex rounded-2xl bg-white px-10 py-4 text-sm font-semibold text-[var(--site-primary)] shadow-lg transition hover:bg-white/95"
              >
                {section.buttonLabel}
              </a>
            </div>
          </div>
        </section>
      );

    case "footer":
      return <FooterSection section={section} />;

    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function HeroSection({ section }: { section: Extract<GeneratedSection, { type: "hero" }> }) {
  const hasBg = Boolean(section.backgroundImageUrl);
  const hasSide = Boolean(section.sideImageUrl);
  const overlay = section.overlayOpacity ?? 0.55;
  const onPhoto = hasBg;

  return (
    <section
      id={section.id}
      className={cn(
        "relative overflow-hidden",
        hasBg && !hasSide && "flex min-h-[min(100svh,56rem)] items-center",
        hasBg && hasSide && "min-h-[min(88svh,52rem)] py-14 md:py-20",
        !hasBg && "min-h-[min(88svh,44rem)] px-6 pb-28 pt-20 md:pb-36 md:pt-24",
      )}
    >
      {hasBg && section.backgroundImageUrl && (
        <div className="absolute inset-0">
          <SiteRemoteImage
            src={section.backgroundImageUrl}
            alt=""
            fill
            priority
            className="scale-[1.02] object-cover object-center"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25"
            style={{ opacity: Math.min(1, overlay + 0.15) }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/50" />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_0%,rgba(0,0,0,0.45)_70%)]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-950/25 via-transparent to-stone-950/40 mix-blend-multiply"
            aria-hidden
          />
        </div>
      )}

      {!hasBg && (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-95"
            style={{
              background: `linear-gradient(145deg, var(--hero-from) 0%, var(--site-bg) 42%, var(--hero-to) 100%)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-[var(--site-primary)]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[var(--site-accent)]/20 blur-3xl" />
        </>
      )}

      <div
        className={cn(
          "relative mx-auto px-6",
          hasSide
            ? "grid max-w-6xl items-center gap-12 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28"
            : "max-w-4xl py-20 text-center md:py-28",
        )}
      >
        <div className={cn(hasSide && "text-left")}>
          <BarberOrnament
            className={cn("mb-8", !hasSide && "mx-auto max-w-xs justify-center", hasSide && "max-w-xs justify-start")}
          />
          {section.eyebrow && (
            <p
              className={cn(
                "mb-4 text-xs font-semibold uppercase tracking-[0.25em]",
                onPhoto ? "text-[color-mix(in_srgb,var(--site-primary)_88%,white)]" : "text-[var(--site-primary)]",
              )}
            >
              {section.eyebrow}
            </p>
          )}
          {section.badge && (
            <span
              className={cn(
                "mb-6 inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
                onPhoto
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-[var(--site-fg)]/10 bg-[var(--site-surface)]/80 text-[var(--site-fg)]/90",
              )}
            >
              {section.badge}
            </span>
          )}
          <h1
            className={cn(
              "text-balance font-serif text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl lg:leading-[1.06]",
              onPhoto ? "text-white [text-shadow:0_2px_40px_rgba(0,0,0,0.55)]" : "text-[var(--site-fg)]",
            )}
          >
            {section.headline}
          </h1>
          {section.subheadline && (
            <p
              className={cn(
                "mt-6 max-w-xl text-pretty text-lg leading-relaxed md:text-xl",
                onPhoto ? "text-white/85" : "text-[var(--site-fg)]/80",
                !hasSide && "mx-auto max-w-2xl",
              )}
            >
              {section.subheadline}
            </p>
          )}
          <div
            className={cn(
              "mt-10 flex flex-col gap-4 sm:flex-row",
              hasSide ? "justify-start" : "items-center justify-center",
            )}
          >
            {section.ctaLabel && (
              <a
                href={section.ctaHref ?? "#"}
                className={cn(
                  "inline-flex min-w-[200px] items-center justify-center rounded-xl px-8 py-4 text-xs font-bold uppercase tracking-[0.14em] shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:opacity-95",
                  onPhoto
                    ? "bg-[var(--site-primary)] text-zinc-950"
                    : "bg-[var(--site-primary)] text-zinc-950",
                )}
              >
                {section.ctaLabel}
              </a>
            )}
            {section.secondaryCtaLabel && (
              <a
                href={section.secondaryCtaHref ?? "#"}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border px-8 py-4 text-xs font-bold uppercase tracking-[0.12em] backdrop-blur transition",
                  onPhoto
                    ? "border-white/35 bg-white/5 text-white hover:bg-white/15"
                    : "border-[var(--site-fg)]/20 bg-[var(--site-surface)]/50 text-[var(--site-fg)] hover:bg-[var(--site-surface)]",
                )}
              >
                {section.secondaryCtaLabel}
              </a>
            )}
          </div>
        </div>

        {hasSide && section.sideImageUrl && (
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[var(--site-primary)]/35 to-[var(--site-accent)]/25 blur-2xl" />
            <div className="relative h-full min-h-[min(420px,50vh)] overflow-hidden rounded-[1.75rem] border border-[var(--site-primary)]/20 shadow-2xl shadow-black/40 ring-1 ring-white/10">
              <SiteRemoteImage
                src={section.sideImageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width:1024px) 100vw, 45vw"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FooterSection({ section }: { section: Extract<GeneratedSection, { type: "footer" }> }) {
  return (
    <footer id={section.id} className="border-t border-white/10 bg-[var(--site-fg)] text-[var(--site-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="font-serif text-xl font-semibold text-[var(--site-bg)]">{section.companyName}</p>
            {section.tagline && <p className="mt-2 text-sm leading-relaxed text-[var(--site-bg)]/65">{section.tagline}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              {section.instagramUrl && (
                <a
                  href={section.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[var(--site-bg)]/90 hover:bg-white/10"
                >
                  Instagram
                </a>
              )}
              {section.facebookUrl && (
                <a
                  href={section.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[var(--site-bg)]/90 hover:bg-white/10"
                >
                  Facebook
                </a>
              )}
              {section.tiktokUrl && (
                <a
                  href={section.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[var(--site-bg)]/90 hover:bg-white/10"
                >
                  TikTok
                </a>
              )}
            </div>
          </div>

          {section.columns?.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--site-bg)]/50">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label + link.href}>
                    <a href={link.href} className="text-sm text-[var(--site-bg)]/80 hover:text-[var(--site-bg)]">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--site-bg)]/50">Contact</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--site-bg)]/80">
              {section.address && <li className="whitespace-pre-line">{section.address}</li>}
              {section.phone && (
                <li>
                  <a href={`tel:${section.phone.replace(/\s/g, "")}`} className="hover:text-[var(--site-bg)]">
                    {section.phone}
                  </a>
                </li>
              )}
              {section.email && (
                <li>
                  <a href={`mailto:${section.email}`} className="hover:text-[var(--site-bg)]">
                    {section.email}
                  </a>
                </li>
              )}
              {section.openingHours && (
                <li className="mt-4 whitespace-pre-line text-[var(--site-bg)]/65">{section.openingHours}</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-[var(--site-bg)]/45">
          © {new Date().getFullYear()} {section.companyName}
        </div>
      </div>
    </footer>
  );
}
