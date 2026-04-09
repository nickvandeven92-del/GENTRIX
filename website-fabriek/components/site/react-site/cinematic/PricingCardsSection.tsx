import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { Check } from "lucide-react";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { mergeButtonClass, siteButtonStyleAccent } from "@/components/site/ui/site-button";
import type { ResolveHref } from "@/components/site/react-site/cinematic/types";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "pricing_cards" }>;

export function PricingCardsSection({
  section,
  accentVar,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  accentVar: string;
  resolveHref: ResolveHref;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  return (
    <section
      id={section.id}
      className={cn("bg-zinc-950 px-6 py-24 text-white sm:px-10 lg:px-16 lg:py-32", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-6xl">
        {p.kicker ? (
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: `var(${accentVar})` }}
          >
            {p.kicker}
          </p>
        ) : null}
        <h2 className="text-center font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h2>
        {p.intro ? <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">{p.intro}</p> : null}
        <ul className="mt-14 grid gap-6 lg:grid-cols-3">
          {p.items.map((plan, i) => (
            <li key={`${plan.name}-${i}`} className={plan.highlighted ? "lg:-mt-2 lg:mb-2" : ""}>
              <FadeUpItem index={i}>
                <div
                  className={`flex h-full flex-col rounded-2xl border-2 p-8 ${
                    plan.highlighted
                      ? "border-transparent bg-white/[0.08] shadow-xl shadow-black/40"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                  style={plan.highlighted ? { borderColor: `var(${accentVar})` } : undefined}
                >
                  <p className="text-sm font-medium uppercase tracking-wider text-zinc-400">{plan.name}</p>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="font-serif text-4xl font-semibold tabular-nums">{plan.price}</span>
                    {plan.period ? <span className="text-sm text-zinc-500">{plan.period}</span> : null}
                  </p>
                  {plan.description ? <p className="mt-3 text-sm text-zinc-400">{plan.description}</p> : null}
                  {plan.features?.length ? (
                    <ul className="mt-8 flex-1 space-y-3 text-sm text-zinc-300">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex gap-2">
                          <Check className="size-4 shrink-0" style={{ color: `var(${accentVar})` }} aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <a
                    href={resolveHref(plan.cta.href)}
                    className={mergeButtonClass("primary", "md", "mt-8 w-full")}
                    style={siteButtonStyleAccent(accentVar)}
                  >
                    {plan.cta.label}
                  </a>
                </div>
              </FadeUpItem>
            </li>
          ))}
        </ul>
      </FadeUp>
    </section>
  );
}
