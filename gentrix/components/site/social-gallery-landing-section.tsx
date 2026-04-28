import type { SocialGalleryItem } from "@/lib/social/social-gallery";

type Props = {
  items: SocialGalleryItem[];
};

export function SocialGalleryLandingSection({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--site-foreground, var(--site-fg, #111827))" }}>
          Laatste social posts
        </h2>
        <p className="text-sm" style={{ color: "var(--site-muted-foreground, var(--site-fg, #6b7280))" }}>
          Automatisch ververst
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.slice(0, 9).map((item) => (
          <a
            key={item.id}
            href={item.permalink ?? item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square overflow-hidden"
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--site-border, var(--site-fg, var(--site-foreground, #d4d4d8)))",
              borderRadius: "var(--radius-lg, 1rem)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.caption ?? ""}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
