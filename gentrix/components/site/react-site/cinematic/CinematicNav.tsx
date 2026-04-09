import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { CinematicNavMenuEntries } from "@/components/site/react-site/cinematic/cinematic-nav-menu";
import { MotionNavShell } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "./types";
import { cn } from "@/lib/utils";

type NavSection = Extract<ReactSiteSection, { type: "nav_overlay" }>;

const fontSans = { fontFamily: "var(--site-font-sans)" } as const;
const fontSerifLogo = { fontFamily: "var(--site-font-serif)" } as const;

export function CinematicNav({ section, resolveHref }: { section: NavSection; resolveHref: ResolveHref }) {
  const { logoText, links } = section.props;
  const barStyle = section.props.barStyle ?? "floating";

  if (barStyle === "bar_light") {
    return (
      <header
        className="sticky top-0 z-50 w-full border-b border-zinc-200/90 bg-white/92 backdrop-blur-md shadow-sm"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-3.5 sm:flex-row sm:justify-between sm:gap-6 sm:px-6">
          <span
            className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg"
            style={fontSerifLogo}
          >
            {logoText}
          </span>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.9375rem] sm:text-sm"
            aria-label="Hoofdnavigatie"
          >
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />
          </nav>
        </div>
      </header>
    );
  }

  if (barStyle === "bar_dark") {
    return (
      <header
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/92 text-white backdrop-blur-md"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-3.5 sm:flex-row sm:justify-between sm:gap-6 sm:px-6">
          <span
            className="text-base font-semibold tracking-tight text-white sm:text-lg"
            style={fontSerifLogo}
          >
            {logoText}
          </span>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.9375rem] sm:text-sm"
            aria-label="Hoofdnavigatie"
          >
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />
          </nav>
        </div>
      </header>
    );
  }

  /* floating — glass pill; fonts uit theme, geen Tailwind font-serif (systeem-Times) */
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5 sm:pt-6">
      <MotionNavShell
        className={cn(
          "pointer-events-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl border px-5 py-4 shadow-lg backdrop-blur-md sm:flex-row sm:justify-between sm:gap-6",
          "border-white/15 bg-black/40",
        )}
        style={{ ...fontSans, borderColor: "rgba(255,255,255,0.14)" }}
      >
        <span
          className="text-lg font-semibold tracking-tight text-white"
          style={fontSerifLogo}
        >
          {logoText}
        </span>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[0.9375rem] sm:text-sm"
          aria-label="Hoofdnavigatie"
        >
          <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />
        </nav>
      </MotionNavShell>
    </header>
  );
}
