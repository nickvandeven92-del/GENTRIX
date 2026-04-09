import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import {
  AtSign,
  Clock,
  Crown,
  LayoutGrid,
  MapPin,
  Phone,
  Scissors,
  Sparkles,
  Star,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FadeUp, FadeUpItem } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "bento_grid" }>;

const ICON_MAP = {
  scissors: Scissors,
  sparkles: Sparkles,
  crown: Crown,
  zap: Zap,
  map_pin: MapPin,
  clock: Clock,
  phone: Phone,
  instagram: AtSign,
  star: Star,
  layout_grid: LayoutGrid,
  user: User,
} as const satisfies Record<string, LucideIcon>;

type IconKey = keyof typeof ICON_MAP;

const spanClass: Record<NonNullable<Section["props"]["items"][number]["span"]>, string> = {
  "1x1": "md:col-span-1 md:row-span-1",
  "2x1": "md:col-span-2 md:row-span-1",
  "1x2": "md:col-span-1 md:row-span-2",
  "2x2": "md:col-span-2 md:row-span-2",
};

export function BentoGridSection({
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
        <ul className="mt-14 grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
          {p.items.map((item, i) => {
            const Icon =
              item.icon && item.icon in ICON_MAP ? ICON_MAP[item.icon as IconKey] : Sparkles;
            const span = item.span ?? "1x1";
            return (
              <li key={`${item.title}-${i}`} className={cn("min-h-[140px]", spanClass[span])}>
                <FadeUpItem index={i}>
                  <div className="flex h-full min-h-[inherit] flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                    <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-zinc-300">
                      <Icon className="size-5" strokeWidth={1.75} style={{ color: `var(${accentVar})` }} />
                    </span>
                    <h3 className="font-sans text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </FadeUpItem>
              </li>
            );
          })}
        </ul>
      </FadeUp>
    </section>
  );
}
