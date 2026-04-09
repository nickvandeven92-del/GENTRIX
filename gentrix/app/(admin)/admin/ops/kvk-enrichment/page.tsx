import type { Metadata } from "next";
import { KvkLeadEnrichmentClient } from "@/components/kvk-enrichment/kvk-lead-enrichment-client";

export const metadata: Metadata = {
  title: "KVK prospecting",
};

export default function KvkEnrichmentPage() {
  return <KvkLeadEnrichmentClient />;
}
