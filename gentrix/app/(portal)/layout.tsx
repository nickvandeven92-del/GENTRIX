import type { ReactNode } from "react";

/** Zelfde rechte-hoeken-tokens als CRM/dashboard (`globals.css` → `.gentrix-ui-sharp`). */
export default function PortalRouteGroupLayout({ children }: { children: ReactNode }) {
  return <div className="gentrix-ui-sharp">{children}</div>;
}
