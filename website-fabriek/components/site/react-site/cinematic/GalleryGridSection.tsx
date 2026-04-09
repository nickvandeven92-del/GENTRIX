import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "gallery_grid" }>;

const colClass = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function GalleryGridSection({
  section,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const cols = colClass[p.columns ?? "3"];
  return (
    <section
      id={section.id}
      className={cn("bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-6xl">
        {p.kicker ? (
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
        ) : null}
        {p.title ? (
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{p.title}</h2>
        ) : null}
        <ul className={`mt-12 grid grid-cols-1 gap-4 ${cols}`}>
          {p.images.map((im, i) => (
            <li key={`${im.url}-${i}`}>
              <FadeUpItem index={i}>
                <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={im.url}
                    alt={im.alt ?? ""}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              </FadeUpItem>
            </li>
          ))}
        </ul>
      </FadeUp>
    </section>
  );
}
