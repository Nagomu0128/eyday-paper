import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  IconClock,
  IconClose,
  IconExternal,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconSpinner,
  IconStar,
} from "../lib/icons";
import { suggestionsStore, useSuggestionsStatus } from "../lib/suggestionsStore";
import type { Suggestion } from "../types";
import { Button, EmptyState, Skeleton } from "./ui";

const SOURCE_LABEL: Record<Suggestion["source"], string> = {
  s2: "Semantic Scholar",
  arxiv: "arXiv",
  openalex: "OpenAlex",
};

export function Suggestions() {
  const [data, setData] = useState<{ classic: Suggestion[]; recent: Suggestion[] } | null>(null);
  const [query, setQuery] = useState("");
  const { refreshing, error, finishedAt } = useSuggestionsStatus();

  const runRefresh = () => {
    if (refreshing) return;
    suggestionsStore.refresh(query.trim() || undefined);
  };

  const load = () => {
    api
      .getSuggestions()
      .then(setData)
      .catch(() => setData({ classic: [], recent: [] }));
  };
  // Reload when the (global) refresh job finishes — even if it started on another tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch on mount + completion
  useEffect(load, [finishedAt]);

  const empty = data !== null && data.classic.length === 0 && data.recent.length === 0;
  const showSkeleton = data === null || (empty && refreshing);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8">
        <div className="mb-6">
          <div className="mb-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Suggestions</h1>
            <p className="mt-1 text-sm text-ink-muted">
              実データから根拠づけて提案します。検索したいテーマを入力するとその意図で探します（空欄なら蔵書と興味タグから）。
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runRefresh();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <IconSearch className="text-[1.1rem] text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例: 拡散モデルの高速サンプリング（空欄で蔵書＋興味タグ）"
                maxLength={300}
                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
            </div>
            <Button
              type="submit"
              variant={refreshing ? "secondary" : "primary"}
              disabled={refreshing}
            >
              {refreshing ? <IconSpinner /> : <IconSparkles />}
              {refreshing ? "更新中…" : "更新"}
            </Button>
          </form>
        </div>

        {refreshing && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary-softer px-4 py-3 text-[0.85rem] text-primary-ink">
            <IconSpinner className="text-[1.1rem] text-primary" />
            提案を生成しています。別のタブに移動しても処理は続き、完了後に反映されます。
          </div>
        )}
        {error && !refreshing && (
          <div className="mb-5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[0.85rem] text-danger">
            {error}
          </div>
        )}

        {showSkeleton ? (
          <div className="space-y-8">
            <SkeletonGroup />
            <SkeletonGroup />
          </div>
        ) : empty ? (
          <EmptyState
            icon={<IconSparkles />}
            title="まだ提案がありません"
            description="「更新」を押すか、論文を取り込むと、定番と最新の論文が提案されます。"
            action={
              <Button variant="primary" onClick={runRefresh} disabled={refreshing}>
                <IconSparkles />
                提案を生成
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {data && data.classic.length > 0 && (
              <Group
                title="定番"
                hint="基礎・重要文献"
                icon={<IconStar />}
                items={data.classic}
                onAction={load}
              />
            )}
            {data && data.recent.length > 0 && (
              <Group
                title="最新"
                hint="新しい研究"
                icon={<IconClock />}
                items={data.recent}
                onAction={load}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  hint,
  icon,
  items,
  onAction,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  items: Suggestion[];
  onAction: () => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-[1.05rem] text-accent-ink">
          {icon}
        </span>
        <h2 className="text-[1.05rem] font-semibold text-ink">{title}</h2>
        <span className="text-[0.78rem] text-ink-faint">{hint}</span>
        <span className="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-ink-muted">
          {items.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id} s={s} onAction={onAction} />
        ))}
      </div>
    </section>
  );
}

function Card({ s, onAction }: { s: Suggestion; onAction: () => void }) {
  const [busy, setBusy] = useState<null | "import" | "dismiss">(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (kind: "import" | "dismiss", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setErr(null);
    try {
      await fn();
      onAction();
    } catch {
      setErr(
        kind === "import"
          ? "取り込みに失敗しました。元リンクから確認してください。"
          : "操作に失敗しました。",
      );
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[0.66rem] font-medium uppercase tracking-wide text-ink-muted ring-1 ring-line">
          {SOURCE_LABEL[s.source]}
        </span>
        {s.year && <span className="text-[0.72rem] text-ink-faint">{s.year}</span>}
      </div>
      <h3 className="font-medium leading-snug text-ink">{s.title}</h3>
      <p className="mt-1 line-clamp-1 text-[0.78rem] text-ink-muted">
        {s.authors.join(", ") || "—"}
      </p>
      {s.reason && (
        <p className="mt-2 line-clamp-3 text-[0.82rem] leading-6 text-ink-muted">
          <IconSparkles className="mr-1 inline text-[0.9em] text-accent" />
          {s.reason}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act("import", () => api.importSuggestion(s.id))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {busy === "import" ? <IconSpinner /> : <IconPlus />}
          取り込む
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act("dismiss", () => api.dismissSuggestion(s.id))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[0.8rem] text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
        >
          {busy === "dismiss" ? <IconSpinner /> : <IconClose />}
          非表示
        </button>
        {s.url && (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 self-center text-[0.78rem] text-ink-faint transition-colors hover:text-primary"
          >
            元を見る
            <IconExternal className="text-[0.95em]" />
          </a>
        )}
      </div>
      {err && <p className="mt-2 text-[0.75rem] text-danger">{err}</p>}
    </div>
  );
}

function SkeletonGroup() {
  return (
    <section>
      <Skeleton className="mb-3 h-7 w-32" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-3 h-4 w-2/3" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </section>
  );
}
