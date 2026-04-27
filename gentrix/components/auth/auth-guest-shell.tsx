import type { ReactNode } from "react";

/** Buitenste vlak voor /login*: zelfde basis als SalesOsShell (Vercel-achtig licht grijs). */
export function AuthGuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="sales-os flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-6 py-12 font-sans text-[13px] leading-normal text-neutral-900 antialiased">
      {children}
    </div>
  );
}
