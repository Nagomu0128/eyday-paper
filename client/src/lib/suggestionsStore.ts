import { useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * Module-scoped store for the suggestion refresh job. Living above the component
 * tree means an in-flight refresh keeps showing its loading state after the user
 * navigates to another tab (and, via the favicon spinner, another browser tab).
 */
export interface SuggestState {
  refreshing: boolean;
  error: string | null;
  lastCount: number | null;
  finishedAt: number | null;
}

let state: SuggestState = { refreshing: false, error: null, lastCount: null, finishedAt: null };
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};
const setState = (patch: Partial<SuggestState>) => {
  state = { ...state, ...patch };
  emit();
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Identity of the current suggestion set; changes once a new batch is stored. */
const signature = async (): Promise<string> => {
  try {
    const d = await api.getSuggestions();
    return [...d.classic, ...d.recent]
      .map((s) => s.id)
      .sort()
      .join(",");
  } catch {
    return "";
  }
};

export const suggestionsStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  snapshot(): SuggestState {
    return state;
  },
  /**
   * Start a background refresh (202) and poll until the stored batch changes.
   * Lives in the store so loading + the favicon spinner persist across tab
   * switches; resolves on completion or after a 60s safety timeout.
   */
  async refresh(): Promise<void> {
    if (state.refreshing) return;
    setState({ refreshing: true, error: null });
    try {
      const before = await signature();
      await api.refreshSuggestions();
      const start = Date.now();
      while (Date.now() - start < 60_000) {
        await delay(2500);
        if ((await signature()) !== before) break;
      }
      setState({ refreshing: false, finishedAt: Date.now() });
    } catch {
      setState({ refreshing: false, error: "提案の更新に失敗しました" });
    }
  },
};

export function useSuggestionsStatus(): SuggestState {
  return useSyncExternalStore(
    suggestionsStore.subscribe,
    suggestionsStore.snapshot,
    suggestionsStore.snapshot,
  );
}
