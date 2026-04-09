import { z } from "zod";

export const AI_KNOWLEDGE_CATEGORIES = [
  "Design Regels",
  "Copywriting",
  "Security",
  "Klant-specifiek",
  "Overig",
  /** Automatische logs; standaard inactief en uitgesloten van system-prompt. */
  "Claude activiteit",
] as const;

export type AiKnowledgeCategory = (typeof AI_KNOWLEDGE_CATEGORIES)[number];

/** Activiteitslogs: worden uitgesloten van de Claude system-prompt (ook als iemand ze op “actief” zet). */
export const KNOWLEDGE_JOURNAL_CATEGORY = "Claude activiteit" satisfies AiKnowledgeCategory;

/** Handmatig aan te maken categorieën in de admin (geen automatische logs). */
export const AI_KNOWLEDGE_MANUAL_CATEGORIES = [
  "Design Regels",
  "Copywriting",
  "Security",
  "Klant-specifiek",
  "Overig",
] as const satisfies ReadonlyArray<AiKnowledgeCategory>;

export type AiKnowledgeManualCategory = (typeof AI_KNOWLEDGE_MANUAL_CATEGORIES)[number];

export const aiKnowledgeCategoryZod = z.enum(
  AI_KNOWLEDGE_CATEGORIES as unknown as [AiKnowledgeCategory, ...AiKnowledgeCategory[]],
);
