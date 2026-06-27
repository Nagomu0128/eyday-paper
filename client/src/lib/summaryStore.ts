import { useSyncExternalStore } from "react";
import type { OutputLang, Summary } from "../types";
import { api } from "./api";

/**
 * Module-scoped store for paper summary generation, keyed by `paperId:lang`.
 * Like suggestionsStore, living above the component tree means an in-flight
 * generation keeps its "生成中…" state after the user navigates to another view
 * (or pane tab) and returns — and the finished summary is cached client-side so
 * reopening the paper shows it instantly (the server also caches per lang).
 */
export type SummaryStatus = "idle" | "generating" | "done" | "error";

export interface SummaryEntry {
  status: SummaryStatus;
  summary: Summary | null;
}

const EMPTY: SummaryEntry = { status: "idle", summary: null };
const keyOf = (paperId: string, lang: OutputLang) => `${paperId}:${lang}`;

let entries: Record<string, SummaryEntry> = {};
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};
const set = (key: string, entry: SummaryEntry) => {
  entries = { ...entries, [key]: entry };
  emit();
};

export const summaryStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  snapshot(): Record<string, SummaryEntry> {
    return entries;
  },
  /**
   * Generate (or fetch the cached) summary. Synchronous on the server — one
   * request returns the full summary — so there's no polling; the store just
   * persists the in-flight + result state across navigation.
   */
  async generate(paperId: string, lang: OutputLang): Promise<void> {
    const key = keyOf(paperId, lang);
    if (entries[key]?.status === "generating") return;
    set(key, { status: "generating", summary: entries[key]?.summary ?? null });
    try {
      const summary = await api.getSummary(paperId, lang);
      set(key, { status: "done", summary });
    } catch {
      set(key, { status: "error", summary: null });
    }
  },
};

export function useSummary(paperId: string, lang: OutputLang): SummaryEntry {
  const map = useSyncExternalStore(
    summaryStore.subscribe,
    summaryStore.snapshot,
    summaryStore.snapshot,
  );
  return map[keyOf(paperId, lang)] ?? EMPTY;
}
