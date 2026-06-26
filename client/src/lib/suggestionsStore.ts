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
  async refresh(): Promise<void> {
    if (state.refreshing) return;
    setState({ refreshing: true, error: null });
    try {
      const { count } = await api.refreshSuggestions();
      setState({ refreshing: false, lastCount: count, finishedAt: Date.now() });
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
