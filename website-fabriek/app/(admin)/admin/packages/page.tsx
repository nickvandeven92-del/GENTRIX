import { redirect } from "next/navigation";

/** Oude route: studio heeft geen aparte pakketten-pagina meer. */
export default function AdminPackagesRedirectPage() {
  redirect("/admin/ops/studio");
}
