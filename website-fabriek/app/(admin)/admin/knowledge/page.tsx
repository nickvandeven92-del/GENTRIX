import type { Metadata } from "next";
import { AiKnowledgeAdminPanel } from "@/components/admin/ai-knowledge-admin";
import { listAiKnowledgeForAdmin } from "@/lib/data/ai-knowledge";

export const metadata: Metadata = {
  title: "AI-kennis",
};

export default async function AdminKnowledgePage() {
  const rows = await listAiKnowledgeForAdmin();

  return <AiKnowledgeAdminPanel initialRows={rows} />;
}
