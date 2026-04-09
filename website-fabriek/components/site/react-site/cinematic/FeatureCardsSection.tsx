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

type Section = Extract<ReactSiteSection, { type: "feature_cards" }>;

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

export function FeatureCardsSection({
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
      className={cn("bg-zinc-950 px-6 py-24 text-white sm:px-10 lg:px-16 lg:py-32", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-6xl">
        {p.kicker ? (
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: `var(${accentVar})` }}
          >
            {p.kicker}
          </p>
        ) : null}
        <h2 className="text-center font-sans text-3xl font-extrabold uppercase tracking-tight sm:text-4xl lg:text-5xl">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg, var(--site-primary), var(${accentVar}))`,
            }}
          >
            {p.title}
          </span>
          {p.titleAccent ? (
            <>
              <br />
              <span className="text-white">{p.titleAccent}</span>
            </>
          ) : null}
        </h2>
        {p.intro ? <p className="mx-auto mt-6 max-w-2xl text-center text-base text-zinc-400">{p.intro}</p> : null}
        <ul className={`mt-14 grid gap-5 ${cols}`}>
          {p.items.map((item, i) => {
            const Icon =
              item.icon && item.icon in ICON_MAP ? ICON_MAP[item.icon as IconKey] : Sparkles;
            const glow = i % 2 === 0 ? "var(--site-primary)" : `var(${accentVar})`;
            return (
              <li key={`${item.title}-${i}`}>
                <FadeUpItem index={i}>
                  <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/40 backdrop-blur-sm transition hover:border-white/25">
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-black/40"
                        style={{ color: glow }}
                        aria-hidden
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                      <h3 className="font-sans text-lg font-bold uppercase tracking-wide text-white">{item.title}</h3>
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                    {item.price ? (
                      <p
                        className="mt-5 font-sans text-2xl font-bold tabular-nums tracking-tight"
                        style={{
                          color: glow,
                          textShadow: `0 0 24px color-mix(in srgb, ${glow} 55%, transparent)`,
                        }}
                      >
                        {item.price}
                      </p>
                    ) : null}
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
