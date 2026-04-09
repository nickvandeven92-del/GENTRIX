import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "stats_strip" }>;

export function StatsStripSection({
  section,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  fixedNavOverlapClass?: string;
}) {
  const { items } = section.props;
  return (
    <section
      id={section.id}
      className={cn("border-y border-white/10 bg-black px-6 py-12 sm:px-10 lg:py-16", fixedNavOverlapClass)}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-center gap-10 sm:gap-14 md:gap-24">
        {items.map((item, i) => (
          <FadeUpItem key={`${item.value}-${item.label}`} index={i} className="min-w-[120px] text-center">
            <p className="font-sans text-3xl font-bold tabular-nums text-white sm:text-4xl md:text-5xl">{item.value}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-zinc-500">{item.label}</p>
          </FadeUpItem>
        ))}
      </div>
    </section>
  );
}
