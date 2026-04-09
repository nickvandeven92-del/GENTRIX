import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ slug?: string }> };

export default async function LegacyGeneratorRedirect({ searchParams }: Props) {
  const { slug } = await searchParams;
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  redirect(`/admin/ops/studio${q}`);
}
