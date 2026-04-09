import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";
import type { ResolveHref } from "./types";
import { cx } from "./types";

type Closing = Extract<ReactSiteSection, { type: "closing" }>;

export function ClosingSection({
  section,
  accentVar,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Closing;
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
          "relative overflow-hidden px-6 py-24 sm:px-10 sm:py-28 lg:px-16 lg:py-32",
          dark ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-900",
        ),
        fixedNavOverlapClass,
      )}
    >
      {p.backgroundImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.backgroundImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" aria-hidden />
        </>
      ) : null}
      <FadeUp className="relative z-10 mx-auto max-w-3xl text-center">
        {p.eyebrow ? (
          <p className={cx("mb-4 text-xs font-semibold uppercase tracking-[0.2em]", dark ? "text-white/60" : "text-zinc-500")}>
            {p.eyebrow}
          </p>
        ) : null}
        <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{p.title}</h2>
        {p.body ? (
          <FadeUp delay={0.08}>
            <p className={cx("mx-auto mt-6 max-w-xl text-lg", dark ? "text-white/80" : "text-zinc-600")}>{p.body}</p>
          </FadeUp>
        ) : null}
        <FadeUp delay={0.14} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
          <a
            href={resolveHref(p.primary.href)}
            className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
            style={{ backgroundColor: `var(${accentVar})` }}
          >
            {p.primary.label}
          </a>
          {p.secondary ? (
            <a
              href={resolveHref(p.secondary.href)}
              className={cx(
                "inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl border px-8 py-3 text-sm font-semibold transition",
                dark ? "border-white/35 text-white hover:bg-white/10" : "border-zinc-300 text-zinc-900 hover:bg-white",
              )}
            >
              {p.secondary.label}
            </a>
          ) : null}
        </FadeUp>
      </FadeUp>
    </section>
  );
}
