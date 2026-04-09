import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp, LivingAccent } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";
import type { ResolveHref } from "./types";
import { cx } from "./types";

type Statement = Extract<ReactSiteSection, { type: "statement" }>;

export function StatementSection({
  section,
  accentVar,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Statement;
  accentVar: string;
  resolveHref: ResolveHref;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const dark = p.variant === "dark";
  const center = p.align !== "left";

  return (
    <section
      id={section.id}
      className={cn(
        cx(
          "px-6 py-24 sm:px-10 sm:py-32 lg:px-16 lg:py-40",
          dark ? "bg-zinc-950 text-white" : "bg-white text-zinc-900",
        ),
        fixedNavOverlapClass,
      )}
    >
      <FadeUp className={cx("mx-auto max-w-4xl", center && "text-center")}>
        {p.kicker ? (
          <p
            className={cx(
              "mb-4 text-xs font-semibold uppercase tracking-[0.25em]",
              dark ? "text-white/50" : "text-zinc-500",
            )}
          >
            {p.kicker}
          </p>
        ) : null}
        <h2
          className={cx(
            "font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl",
            center && "mx-auto max-w-3xl",
          )}
        >
          {p.headline}
          {p.headlineAccent ? (
            <>
              <br />
              <LivingAccent style={{ color: `var(${accentVar})` }}>{p.headlineAccent}</LivingAccent>
            </>
          ) : null}
        </h2>
        {p.subline ? (
          <FadeUp delay={0.1}>
            <p
              className={cx(
                "mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl",
                center && "mx-auto",
                dark ? "text-white/75" : "text-zinc-600",
              )}
            >
              {p.subline}
            </p>
          </FadeUp>
        ) : null}
        {p.cta ? (
          <FadeUp delay={0.18} className={cx("mt-12", center && "flex justify-center")}>
            <a
              href={resolveHref(p.cta.href)}
              className={cx(
                "inline-flex min-h-12 items-center justify-center rounded-full border-2 px-8 py-3 text-sm font-semibold transition hover:opacity-90",
                dark && "border-white/55 text-white",
              )}
              style={
                dark
                  ? undefined
                  : { borderColor: `var(${accentVar})`, color: `var(${accentVar})` }
              }
            >
              {p.cta.label}
            </a>
          </FadeUp>
        ) : null}
      </FadeUp>
    </section>
  );
}
