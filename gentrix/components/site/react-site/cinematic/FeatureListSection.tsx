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

type Section = Extract<ReactSiteSection, { type: "feature_list" }>;

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

export function FeatureListSection({
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
        <ul className="mt-14 space-y-6">
          {p.items.map((item, i) => {
            const Icon =
              item.icon && item.icon in ICON_MAP ? ICON_MAP[item.icon as IconKey] : Sparkles;
            return (
              <li key={`${item.title}-${i}`}>
                <FadeUpItem index={i}>
                  <div className="flex gap-5 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 sm:p-6">
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white"
                      style={{ color: `var(${accentVar})` }}
                      aria-hidden
                    >
                      <Icon className="size-6" strokeWidth={1.75} />
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-zinc-900">{item.title}</h3>
                      <p className="mt-2 text-zinc-600">{item.body}</p>
                    </div>
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
