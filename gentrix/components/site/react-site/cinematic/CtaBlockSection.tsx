import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { Mail, Phone } from "lucide-react";
import { FadeUp } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "@/components/site/react-site/cinematic/types";
import { mergeButtonClass, siteButtonStyleAccent } from "@/components/site/ui/site-button";
import { cn } from "@/lib/utils";

type Section = Extract<ReactSiteSection, { type: "cta_block" }>;

export function CtaBlockSection({
  section,
  accentVar,
  resolveHref,
  fixedNavOverlapClass = "",
}: {
  section: Section;
  accentVar: string;
  resolveHref: ResolveHref;
  fixedNavOverlapClass?: string;
}) {
  const p = section.props;
  const variant = p.variant ?? "centered";

  const primaryBtn = (
    <a
      href={resolveHref(p.primary.href)}
      className={mergeButtonClass("primary", "md", "inline-flex")}
      style={siteButtonStyleAccent(accentVar)}
    >
      <Mail className="h-4 w-4" aria-hidden />
      {p.primary.label}
    </a>
  );

  const secondaryBtn = p.secondary ? (
    <a
      href={resolveHref(p.secondary.href)}
      className={mergeButtonClass("secondary", "md", "inline-flex dark:border-white/30 dark:text-white")}
    >
      <Phone className="h-4 w-4" aria-hidden />
      {p.secondary.label}
    </a>
  ) : null;

  if (variant === "minimal") {
    return (
      <section id={section.id} className={cn("bg-white px-6 py-16 sm:px-10 lg:px-16", fixedNavOverlapClass)}>
        <FadeUp>
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-zinc-900 sm:text-3xl">{p.title}</h2>
              {p.body ? <p className="mt-2 text-zinc-600">{p.body}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">{primaryBtn}{secondaryBtn}</div>
          </div>
        </FadeUp>
      </section>
    );
  }

  if (variant === "split") {
    return (
      <section
        id={section.id}
        className={cn("bg-zinc-100 px-6 py-20 sm:px-10 lg:px-16 lg:py-24", fixedNavOverlapClass)}
      >
        <FadeUp>
          <div className="mx-auto grid max-w-6xl gap-10 rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{p.title}</h2>
              {p.body ? <p className="mt-4 text-lg text-zinc-600">{p.body}</p> : null}
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:justify-end">
              {primaryBtn}
              {secondaryBtn}
            </div>
          </div>
        </FadeUp>
      </section>
    );
  }

  if (variant === "overlay" && p.backgroundImageUrl) {
    return (
      <section id={section.id} className={cn("relative px-6 py-24 sm:px-10 lg:px-16 lg:py-32", fixedNavOverlapClass)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.backgroundImageUrl} alt="" className="absolute inset-0 size-full object-cover" aria-hidden />
        <div className="absolute inset-0 bg-zinc-950/75" aria-hidden />
        <FadeUp className="relative mx-auto max-w-3xl text-center text-white">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{p.title}</h2>
          {p.body ? <p className="mx-auto mt-6 max-w-xl text-lg text-white/85">{p.body}</p> : null}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {primaryBtn}
            {secondaryBtn}
          </div>
        </FadeUp>
      </section>
    );
  }

  return (
    <section
      id={section.id}
      className={cn("bg-zinc-950 px-6 py-24 text-white sm:px-10 lg:px-16 lg:py-32", fixedNavOverlapClass)}
    >
      <FadeUp className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{p.title}</h2>
        {p.body ? <p className="mx-auto mt-6 max-w-xl text-lg text-white/75">{p.body}</p> : null}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {primaryBtn}
          {secondaryBtn}
        </div>
      </FadeUp>
    </section>
  );
}
