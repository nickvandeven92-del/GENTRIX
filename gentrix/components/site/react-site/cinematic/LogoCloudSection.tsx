import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "logo_cloud" }>;

export function LogoCloudSection({
  section,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  return (
    <section
      id={section.id}
      className={cn("border-y border-zinc-200 bg-white px-6 py-14 sm:px-10 lg:px-16", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-6xl">
        {p.kicker ? (
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">{p.kicker}</p>
        ) : null}
        {p.title ? (
          <h2 className="text-center font-serif text-xl font-semibold text-zinc-800 sm:text-2xl">{p.title}</h2>
        ) : null}
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
          {p.logos.map((logo, i) => (
            <li key={`${logo.name}-${i}`}>
              <FadeUpItem index={i}>
                <div className="flex h-12 min-w-[100px] max-w-[160px] items-center justify-center px-4 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0">
                  {logo.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.imageUrl} alt="" className="max-h-10 w-auto object-contain" />
                  ) : (
                    <span className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-600">{logo.name}</span>
                  )}
                </div>
              </FadeUpItem>
            </li>
          ))}
        </ul>
      </FadeUp>
    </section>
  );
}
