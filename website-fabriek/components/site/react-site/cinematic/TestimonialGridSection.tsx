import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { Quote, Star } from "lucide-react";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "testimonial_grid" }>;

export function TestimonialGridSection({
  section,
  accentVar,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  accentVar: string;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const cols = p.columns === "3" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  return (
    <section
      id={section.id}
      className={cn("bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-6xl">
        {p.kicker ? (
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
        ) : null}
        <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{p.title}</h2>
        <ul className={`mt-14 grid gap-6 ${cols}`}>
          {p.items.map((item, i) => (
            <li key={`${item.author}-${i}`}>
              <FadeUpItem index={i}>
                <figure className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6">
                  <Quote className="size-8 text-zinc-300" aria-hidden />
                  {item.rating ? (
                    <div className="mt-3 flex gap-0.5" aria-label={`${item.rating} van 5`}>
                      {Array.from({ length: 5 }, (_, j) => (
                        <Star
                          key={j}
                          className="size-4"
                          fill={j < item.rating! ? `var(${accentVar})` : "none"}
                          stroke={j < item.rating! ? `var(${accentVar})` : "currentColor"}
                          style={{ color: j < item.rating! ? undefined : "rgb(212 212 216)" }}
                        />
                      ))}
                    </div>
                  ) : null}
                  <blockquote className="mt-4 flex-1 text-base leading-relaxed text-zinc-700">&ldquo;{item.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 border-t border-zinc-200 pt-4">
                    <p className="font-semibold text-zinc-900">{item.author}</p>
                    {item.role ? <p className="text-sm text-zinc-500">{item.role}</p> : null}
                  </figcaption>
                </figure>
              </FadeUpItem>
            </li>
          ))}
        </ul>
      </FadeUp>
    </section>
  );
}
