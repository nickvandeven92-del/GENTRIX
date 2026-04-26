import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { PUBLIC_BRAND, PUBLIC_STUDIO_CONTACT_EMAIL } from "@/lib/constants";
import { ShowroomWordmark } from "@/components/public/showroom-wordmark";
import { cn } from "@/lib/utils";

/** Eén aanbod — bewerk hier. Op het primaire studio-domein herschrijft middleware standaard `/` naar `/site/home` (generator-slug); zie `LANDING_SITE_ROOT_SLUG` / `off` in `.env.example`. */
const SHOWROOM_SINGLE_OFFER = {
  name: "Studio-pakket",
  line: "Website, beheer in overleg, klantportaal",
  priceLabel: "Investering",
  price: "In overleg",
  detail:
    "Eén helder traject: strategie, vormgeving, techniek en doorlopende ontzorging. Facturatie en (optioneel) afspraken voor jouw klanten op één plek.",
} as const;

const STEPS = [
  {
    title: "Fundament",
    body: "Doelen, structuur en merk — rustig uitwerken voordat er gebouwd wordt.",
  },
  {
    title: "Vorm & techniek",
    body: "Strak ontwerp, snelle performance, toegankelijk waar het telt.",
  },
  {
    title: "Live & nabij",
    body: "Lancering, monitoring en korte lijnen wanneer je iets nodig hebt.",
  },
] as const;

function GlassPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_0_60px_-15px_rgba(34,211,238,0.18)] max-md:backdrop-blur-none md:bg-white/[0.03] md:backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Publieke homepage (`/`): hypermodern, glassmorphism, space charcoal + neon cyan — puur CSS (geen externe 3D-assets).
 */
export function ShowroomFallback() {
  const p = SHOWROOM_SINGLE_OFFER;
  const mailto = `mailto:${encodeURIComponent(PUBLIC_STUDIO_CONTACT_EMAIL)}`;

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#05080d] text-zinc-300 antialiased",
        "selection:bg-cyan-400/25 selection:text-white",
      )}
    >
      {/* Diepe ruimte + subtiele sterrenraster */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(6,182,212,0.06),transparent_45%),radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(139,92,246,0.05),transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.4] [background-image:linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] [background-size:56px_56px]"
        aria-hidden
      />
      {/* “Holografische” gloed — langzaam verschuivende gradient */}
      <div
        className={cn(
          "pointer-events-none fixed -left-1/4 top-0 h-[85vh] w-[85vw] rounded-full opacity-40 blur-[100px]",
          "bg-[linear-gradient(135deg,rgba(34,211,238,0.35),rgba(6,182,212,0.15),rgba(167,139,250,0.2))] showroom-holo-shift",
        )}
        aria-hidden
      />

      {/* Abstracte zwevende vormen */}
      <div
        className={cn(
          "pointer-events-none absolute -right-24 top-32 h-[min(90vw,420px)] w-[min(90vw,420px)] rounded-[40%] bg-cyan-400/20 blur-[80px]",
          "showroom-drift",
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -left-32 bottom-40 h-[min(80vw,360px)] w-[min(80vw,360px)] rounded-full bg-violet-500/15 blur-[90px]",
          "showroom-drift-reverse",
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[12%] top-[38%] hidden h-48 w-48 rotate-12 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/10 to-transparent md:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[8%] top-[48%] hidden h-32 w-32 -rotate-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm md:block"
        aria-hidden
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#05080d]/92 max-md:backdrop-blur-none md:bg-[#05080d]/80 md:backdrop-blur-xl supports-[backdrop-filter]:md:bg-[#05080d]/55">
        <div className="mx-auto flex min-h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:min-h-[4.75rem] md:px-8 md:py-4">
          <ShowroomWordmark />
          <nav className="flex flex-wrap items-center justify-end gap-4 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 md:gap-8">
            <a href="#aanpak" className="transition hover:text-cyan-200/90">
              Aanpak
            </a>
            <a href="#aanbod" className="transition hover:text-cyan-200/90">
              Aanbod
            </a>
            <a href="#contact" className="transition hover:text-cyan-200/90">
              Contact
            </a>
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1.5 text-cyan-200 shadow-[0_0_20px_-4px_rgba(34,211,238,0.5)] transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
            >
              <LayoutDashboard className="size-3.5" aria-hidden />
              Client dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 pt-[4.25rem] md:pt-[4.75rem]">
        <section className="px-5 pb-24 pt-10 md:px-8 md:pb-32 md:pt-14">
          <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
                <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_2px_rgba(34,211,238,0.7)]" />
                Premium web agency
              </p>
              <h1 className="mt-8 text-balance text-4xl font-light leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
                <span className="bg-gradient-to-b from-white via-cyan-50 to-cyan-400/85 bg-clip-text text-transparent">
                  Websites van de toekomst.
                </span>
                <span className="mt-3 block bg-gradient-to-r from-zinc-400 via-zinc-500 to-zinc-600 bg-clip-text text-transparent md:mt-4">
                  Futuristisch vakmanschap. Geen ruis.
                </span>
              </h1>
              <p className="mt-8 max-w-lg text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
                Glassmorphism, scherpe typografie en techniek die klaar is voor morgen — wij bouwen je digitale
                aanwezigheid alsof het een high-end interface is.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href={mailto}
                  className="group inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-400/20 to-cyan-500/10 px-8 py-3.5 text-sm font-medium text-cyan-50 shadow-[0_0_32px_-8px_rgba(34,211,238,0.55)] transition hover:border-cyan-300/60 hover:from-cyan-400/30 hover:to-cyan-500/20"
                >
                  Start een gesprek
                  <ArrowUpRight
                    className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </a>
                <a
                  href="#aanbod"
                  className="text-sm font-medium text-zinc-500 underline decoration-cyan-500/25 underline-offset-4 transition hover:text-cyan-200/90"
                >
                  Bekijk aanbod
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <GlassPanel className="relative overflow-hidden p-8 md:p-10">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/10" aria-hidden />
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-400/80">Signal</p>
                  <p className="mt-4 font-mono text-sm text-zinc-400">
                    <span className="text-cyan-300/90">●</span> systeem actief — concept → build → orbit
                  </p>
                  <div className="mt-8 space-y-4 border-t border-white/[0.08] pt-8">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>Render pipeline</span>
                      <span className="font-mono text-cyan-400/80">8K-ready</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      Cinematic lighting in je merk — donkere basis, neon-accenten, glas en diepte. Alles wat je in de
                      prompt beschrijft, vertalen we naar een strakke live site in de studio.
                    </p>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        </section>

        <section id="aanpak" className="scroll-mt-[5.5rem] border-t border-white/[0.06] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-6xl md:grid md:grid-cols-12 md:gap-12">
            <div className="md:col-span-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-500/80">Aanpak</h2>
              <p className="mt-4 text-2xl font-light tracking-tight text-white md:text-3xl">Drie heldere fasen.</p>
            </div>
            <ol className="mt-14 space-y-10 md:col-span-7 md:mt-0 md:space-y-14">
              {STEPS.map((item, i) => (
                <li
                  key={item.title}
                  className="grid gap-4 border-l border-cyan-500/20 pl-8 md:grid-cols-[4rem_1fr] md:gap-8 md:pl-10"
                >
                  <span className="font-mono text-xs tabular-nums text-cyan-500/50 md:-ml-2">0{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-medium text-white">{item.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="aanbod" className="scroll-mt-[5.5rem] border-t border-white/[0.06] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-500/80">Aanbod</h2>
            <p className="mt-4 text-2xl font-light tracking-tight text-white md:text-3xl">Eén traject, volledig uitgewerkt.</p>

            <GlassPanel className="mt-14 overflow-hidden p-8 md:p-12">
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-cyan-400/15" aria-hidden />
              <div className="relative">
                <div className="flex flex-col gap-2 border-b border-white/[0.08] pb-8 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-500/70">{p.name}</p>
                    <p className="mt-2 text-lg text-zinc-200">{p.line}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{p.priceLabel}</p>
                    <p className="mt-1 font-mono text-xl text-cyan-200">{p.price}</p>
                  </div>
                </div>
                <p className="mt-8 text-sm leading-relaxed text-zinc-400">{p.detail}</p>
                <a
                  href={mailto}
                  className="mt-10 inline-flex w-full items-center justify-center rounded-xl border border-cyan-400/30 bg-white/[0.04] py-4 text-sm font-medium text-cyan-50 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 md:w-auto md:px-12"
                >
                  Plan een kennismaking
                </a>
              </div>
            </GlassPanel>
          </div>
        </section>

        <section id="contact" className="scroll-mt-[5.5rem] border-t border-white/[0.06] px-5 py-24 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-500/80">Contact</h2>
            <p className="mt-6 text-2xl font-light tracking-tight text-white md:text-3xl">Laten we het kort houden.</p>
            <p className="mx-auto mt-4 max-w-md text-sm text-zinc-500">
              Mail direct — of werk je landingspagina uit in de studio en publiceer als{" "}
              <code className="font-mono text-cyan-500/80">home</code>.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href={mailto}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-8 py-3.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/20"
              >
                {PUBLIC_STUDIO_CONTACT_EMAIL}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <Link
                href="/admin/ops/studio"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-8 py-3.5 text-sm font-medium text-zinc-300 transition hover:border-cyan-500/25 hover:text-cyan-100"
              >
                Naar studio
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-12 text-center">
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} {PUBLIC_BRAND}
        </p>
      </footer>
    </div>
  );
}
