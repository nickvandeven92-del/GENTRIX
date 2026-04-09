import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { FadeUp } from "@/components/site/react-site/cinematic/cinematic-motion";
import { cn } from "@/lib/utils";
import { cx } from "./types";

type FullBleed = Extract<ReactSiteSection, { type: "full_bleed" }>;

const overlayClass: Record<NonNullable<FullBleed["props"]["overlay"]>, string> = {
  none: "",
  light: "bg-black/20",
  medium: "bg-black/40",
  heavy: "bg-black/60",
};

const minHClass: Record<NonNullable<FullBleed["props"]["minHeight"]>, string> = {
  half: "min-h-[50dvh]",
  large: "min-h-[85dvh]",
  screen: "min-h-[100dvh]",
};

export function FullBleedSection({
  section,
  fixedNavOverlapClass = "",
}: {
  section: FullBleed;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const hasMedia = Boolean(p.videoUrl || p.imageUrl);
  const minH = minHClass[p.minHeight ?? "large"];
  const overlay = overlayClass[p.overlay ?? "medium"];

  return (
    <section id={section.id} className={cn(cx("relative w-full overflow-hidden bg-black", minH), fixedNavOverlapClass)}>
      {p.videoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={p.posterUrl}
          src={p.videoUrl}
          aria-hidden
        />
      ) : p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt={p.alt ?? ""} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" aria-hidden />
      )}
      {overlay ? <div className={cx("pointer-events-none absolute inset-0", overlay)} aria-hidden /> : null}

      {(p.captionTitle || p.captionBody) && hasMedia ? (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-10 pt-24 sm:px-10 lg:px-16">
          <FadeUp className="mx-auto max-w-3xl">
            {p.captionTitle ? (
              <p className="font-serif text-2xl font-semibold tracking-tight text-white sm:text-3xl">{p.captionTitle}</p>
            ) : null}
            {p.captionBody ? (
              <FadeUp delay={0.1}>
                <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">{p.captionBody}</p>
              </FadeUp>
            ) : null}
          </FadeUp>
        </div>
      ) : null}
    </section>
  );
}
