import { redirect } from "next/navigation";

/** Oude route per tier; alle klanten delen hetzelfde studio-product. */
export default function AdminPackageIdRedirectPage() {
  redirect("/admin/clients");
}
