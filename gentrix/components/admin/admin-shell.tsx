import type { ReactNode } from "react";
import { AdminHubLayout } from "@/components/admin/admin-hub-layout";

type AdminShellProps = {
  children: ReactNode;
};

/** Hub-layout: horizontale modules (zoals Arvonto-admin) + linker subnav per sectie. */
export function AdminShell({ children }: AdminShellProps) {
  return <AdminHubLayout>{children}</AdminHubLayout>;
}
