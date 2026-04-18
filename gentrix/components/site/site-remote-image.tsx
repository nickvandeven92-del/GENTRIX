import Image from "next/image";

type SiteRemoteImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
};

/** Externe afbeeldingen (o.a. Supabase storage) — domeinen in next.config.ts */
export function SiteRemoteImage({
  src,
  alt,
  className,
  fill,
  width = 1200,
  height = 800,
  sizes,
  priority,
}: SiteRemoteImageProps) {
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes ?? "100vw"}
        priority={priority}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
