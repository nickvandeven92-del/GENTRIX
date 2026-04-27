import type { ReactNode } from "react";
import { AdminThemeBridge } from "@/components/admin/admin-theme-bridge";
import { AuthGuestShell } from "@/components/auth/auth-guest-shell";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminThemeBridge />
      <AuthGuestShell>{children}</AuthGuestShell>
    </>
  );
}
