import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ slug?: string }> };

/** Oude route: studio staat nu onder Sales OS. */
export default async function AdminGeneratorRedirect({ searchParams }: Props) {
  const { slug } = await searchParams;
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  redirect(`/admin/ops/studio${q}`);
}
