import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";

export type SiteHistorySnapshot = {
  sections: TailwindSection[];
  config: TailwindPageConfig | null | undefined;
  label: string;
};

export type SiteHistoryState = {
  entries: SiteHistorySnapshot[];
  index: number;
};

export type SiteHistoryAction =
  | { type: "replace-current"; sections: TailwindSection[]; config: TailwindPageConfig | null | undefined }
  | { type: "patch-section-html"; sectionIndex: number; html: string }
  | { type: "patch-section-name"; sectionIndex: number; sectionName: string }
  | { type: "push-ai"; sections: TailwindSection[]; config: TailwindPageConfig | null | undefined; label: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "jump"; index: number };

function cloneSections(s: TailwindSection[]): TailwindSection[] {
  return s.map((x) => ({ ...x }));
}

export function createInitialSiteHistory(
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
): SiteHistoryState {
  return {
    entries: [
      {
        sections: cloneSections(sections),
        config: config ?? undefined,
        label: "Start (geladen van server)",
      },
    ],
    index: 0,
  };
}

export function siteHistoryReducer(state: SiteHistoryState, action: SiteHistoryAction): SiteHistoryState {
  switch (action.type) {
    case "replace-current": {
      const entries = [...state.entries];
      const cur = entries[state.index];
      if (!cur) return state;
      entries[state.index] = {
        ...cur,
        sections: cloneSections(action.sections),
        config: action.config,
      };
      return { ...state, entries };
    }
    case "patch-section-html": {
      const entries = [...state.entries];
      const cur = entries[state.index];
      if (!cur) return state;
      const nextSec = [...cur.sections];
      const row = nextSec[action.sectionIndex];
      if (!row) return state;
      nextSec[action.sectionIndex] = { ...row, html: action.html };
      entries[state.index] = { ...cur, sections: nextSec };
      return { ...state, entries };
    }
    case "patch-section-name": {
      const entries = [...state.entries];
      const cur = entries[state.index];
      if (!cur) return state;
      const nextSec = [...cur.sections];
      const row = nextSec[action.sectionIndex];
      if (!row) return state;
      nextSec[action.sectionIndex] = { ...row, sectionName: action.sectionName };
      entries[state.index] = { ...cur, sections: nextSec };
      return { ...state, entries };
    }
    case "push-ai": {
      const head = state.entries.slice(0, state.index + 1);
      const nextEntries = [
        ...head,
        {
          sections: cloneSections(action.sections),
          config: action.config,
          label: action.label,
        },
      ];
      return { entries: nextEntries, index: nextEntries.length - 1 };
    }
    case "undo":
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case "redo":
      return state.index < state.entries.length - 1 ? { ...state, index: state.index + 1 } : state;
    case "jump": {
      if (action.index < 0 || action.index >= state.entries.length) return state;
      return { ...state, index: action.index };
    }
    default:
      return state;
  }
}

export function getCurrentSnapshot(state: SiteHistoryState): SiteHistorySnapshot | undefined {
  return state.entries[state.index];
}
