import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { ChevronDown } from "lucide-react";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "faq_accordion" }>;

export function FaqAccordionSection({
  section,
  accentVar,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  accentVar: string;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  return (
    <section
      id={section.id}
      className={cn("bg-zinc-50 px-6 py-20 sm:px-10 lg:px-16 lg:py-28", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-3xl">
        {p.kicker ? (
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
        ) : null}
        <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{p.title}</h2>
        {p.intro ? <p className="mx-auto mt-4 max-w-xl text-center text-zinc-600">{p.intro}</p> : null}
        <div className="mt-12 space-y-3">
          {p.items.map((item, i) => (
            <FadeUpItem key={`${item.question}-${i}`} index={i}>
              <details className="group rounded-2xl border border-zinc-200 bg-white px-5 py-1 shadow-sm open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <ChevronDown
                    className="size-5 shrink-0 text-zinc-400 transition group-open:rotate-180"
                    style={{ color: `var(${accentVar})` }}
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-zinc-100 pb-4 pt-2 text-sm leading-relaxed text-zinc-600">{item.answer}</div>
              </details>
            </FadeUpItem>
          ))}
        </div>
      </FadeUp>
    </section>
  );
}
