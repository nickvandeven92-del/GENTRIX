import type { ReactNode } from "react";

/** Zorgt dat de HTML-editor de volledige werkruimte onder de topbar kan vullen (`h-full` / flex-keten). */
export default function AdminEditorLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
