import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "timeline" }>;

export function TimelineSection({
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
      className={cn("bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-3xl">
        {p.kicker ? (
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
        ) : null}
        <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{p.title}</h2>
        {p.intro ? <p className="mx-auto mt-4 max-w-xl text-center text-zinc-600">{p.intro}</p> : null}
        <ol className="relative mt-16 space-y-10 border-l border-zinc-200 pl-8 sm:pl-10">
          {p.items.map((item, i) => (
            <li key={`${item.title}-${i}`} className="relative">
              <span
                className="absolute -left-[21px] top-1.5 size-3 rounded-full border-2 border-white bg-white sm:-left-[25px]"
                style={{ boxShadow: `0 0 0 2px var(${accentVar})` }}
                aria-hidden
              />
              <FadeUpItem index={i}>
                {item.date ? (
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{item.date}</p>
                ) : null}
                <h3 className="mt-1 font-serif text-xl font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-zinc-600">{item.body}</p>
              </FadeUpItem>
            </li>
          ))}
        </ol>
      </FadeUp>
    </section>
  );
}
