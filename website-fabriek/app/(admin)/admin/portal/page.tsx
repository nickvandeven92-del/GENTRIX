import { redirect } from "next/navigation";

/** Oude klantenportaal-route: alles gaat via Sales OS. */
export default function LegacyAdminPortalRedirect() {
  redirect("/admin/ops");
}
