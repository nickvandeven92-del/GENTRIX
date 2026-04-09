import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { ChevronDown } from "lucide-react";
import { HeroItem, HeroStagger, LivingAccent } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "./types";

type HeroSection = Extract<ReactSiteSection, { type: "hero_cinematic" }>;

export function CinematicHero({
  section,
  accentVar,
  resolveHref,
}: {
  section: HeroSection;
  accentVar: string;
  resolveHref: ResolveHref;
}) {
  const p = section.props;

  if (p.visualTone === "neon") {
    return (
      <section id={section.id} className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
        {p.videoUrl ? (
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={p.posterUrl}
            src={p.videoUrl}
            aria-hidden
          />
        ) : p.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/80 to-black" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              linear-gradient(to right, color-mix(in srgb, var(--site-primary) 14%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in srgb, var(--site-primary) 14%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: "52px 52px",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-28 pt-28 text-center sm:px-10 lg:px-16">
          <HeroStagger className="mx-auto w-full max-w-4xl">
            {p.eyebrow ? (
              <HeroItem>
                <p
                  className="mb-5 text-xs font-semibold uppercase tracking-[0.35em]"
                  style={{ color: `var(--site-primary)` }}
                >
                  {p.eyebrow}
                </p>
              </HeroItem>
            ) : null}
            <HeroItem>
              <h1 className="font-sans text-4xl font-black uppercase leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(90deg, var(--site-primary), var(${accentVar}))`,
                  }}
                >
                  {p.headline}
                </span>
                {p.headlineAccent ? (
                  <>
                    <br />
                    <span className="text-white">
                      <LivingAccent>{p.headlineAccent}</LivingAccent>
                    </span>
                  </>
                ) : null}
              </h1>
            </HeroItem>
            {p.subhead ? (
              <HeroItem>
                <p className="mx-auto mt-8 max-w-2xl text-base text-zinc-300 sm:text-lg">{p.subhead}</p>
              </HeroItem>
            ) : null}
            <HeroItem>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {p.ctaPrimary ? (
                  <a
                    href={resolveHref(p.ctaPrimary.href)}
                    className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl px-8 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 shadow-lg transition hover:opacity-95"
                    style={{
                      backgroundImage: `linear-gradient(90deg, var(--site-primary), var(${accentVar}))`,
                      boxShadow: `0 0 28px color-mix(in srgb, var(--site-primary) 40%, transparent)`,
                    }}
                  >
                    {p.ctaPrimary.label}
                  </a>
                ) : null}
                {p.ctaSecondary ? (
                  <a
                    href={resolveHref(p.ctaSecondary.href)}
                    className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl border-2 border-white/25 bg-black/40 px-8 py-3 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition hover:border-white/50"
                    style={{
                      boxShadow: `0 0 20px color-mix(in srgb, var(${accentVar}) 25%, transparent)`,
                    }}
                  >
                    {p.ctaSecondary.label}
                  </a>
                ) : null}
              </div>
            </HeroItem>
          </HeroStagger>
          {p.showScrollHint ? (
            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-zinc-500">
              <ChevronDown
                className="size-7 animate-bounce"
                style={{ color: `var(--site-primary)` }}
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="sr-only">Scroll voor meer</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id={section.id} className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      {p.videoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={p.posterUrl}
          src={p.videoUrl}
          aria-hidden
        />
      ) : p.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-950" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" aria-hidden />
      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-end px-6 pb-24 pt-40 sm:px-10 lg:px-16 lg:pb-32">
        <HeroStagger className="mx-auto w-full max-w-4xl">
          {p.eyebrow ? (
            <HeroItem>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{p.eyebrow}</p>
            </HeroItem>
          ) : null}
          <HeroItem>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              {p.headline}
              {p.headlineAccent ? (
                <>
                  <br />
                  <LivingAccent style={{ color: `var(${accentVar})` }}>{p.headlineAccent}</LivingAccent>
                </>
              ) : null}
            </h1>
          </HeroItem>
          {p.subhead ? (
            <HeroItem>
              <p className="mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">{p.subhead}</p>
            </HeroItem>
          ) : null}
          <HeroItem>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              {p.ctaPrimary ? (
                <a
                  href={resolveHref(p.ctaPrimary.href)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                  style={{ backgroundColor: `var(${accentVar})` }}
                >
                  {p.ctaPrimary.label}
                </a>
              ) : null}
              {p.ctaSecondary ? (
                <a
                  href={resolveHref(p.ctaSecondary.href)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 bg-black/30 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  {p.ctaSecondary.label}
                </a>
              ) : null}
            </div>
          </HeroItem>
        </HeroStagger>
      </div>
    </section>
  );
}
