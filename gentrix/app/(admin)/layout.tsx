import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminThemeBridge } from "@/components/admin/admin-theme-bridge";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { ADMIN_STUDIO_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    template: `%s | ${ADMIN_STUDIO_NAME}`,
    default: ADMIN_STUDIO_NAME,
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminThemeBridge />
      <AdminChrome>{children}</AdminChrome>
    </>
  );
}
