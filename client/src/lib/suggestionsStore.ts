import { useSyncExternalStore } from "react";
import { ApiError, api } from "./api";

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
  /**
   * Generate + cache suggestions in a single request (the backend runs the batch
   * synchronously and returns the count — no client polling). Lives in the store
   * so the loading state + favicon spinner persist while the user switches tabs;
   * on completion the Suggestions view reloads via `finishedAt`.
   */
  async refresh(query?: string): Promise<void> {
    if (state.refreshing) return;
    setState({ refreshing: true, error: null });
    try {
      const { count } = await api.refreshSuggestions(query);
      setState({ refreshing: false, lastCount: count, finishedAt: Date.now() });
    } catch (err) {
      const limited = err instanceof ApiError && err.status === 429;
      setState({
        refreshing: false,
        error: limited
          ? "本日の更新上限（2回/日、自動更新を含む）に達しました。"
          : "提案の更新に失敗しました",
      });
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
