import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Suggestion } from "../types";

const ingestInputFor = (s: Suggestion): string =>
  s.source === "arxiv" ? s.externalId : (s.url ?? s.externalId);

function Card({ s, onAction }: { s: Suggestion; onAction: () => void }) {
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="font-medium leading-snug">{s.title}</h3>
      <p className="mt-1 line-clamp-1 text-sm text-stone-500">
        {s.authors.join(", ") || "—"}
        {s.year ? ` · ${s.year}` : ""} · {s.source}
      </p>
      {s.reason && <p className="mt-2 text-sm text-stone-700">{s.reason}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => api.importSuggestion(s.id, ingestInputFor(s)))}
          className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          取り込む
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => api.dismissSuggestion(s.id))}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
        >
          非表示
        </button>
        {s.url && (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto self-center text-sm text-stone-400 hover:text-stone-700"
          >
            元を見る ↗
          </a>
        )}
      </div>
    </div>
  );
}

export function Suggestions() {
  const [data, setData] = useState<{ classic: Suggestion[]; recent: Suggestion[] }>({
    classic: [],
    recent: [],
  });
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .getSuggestions()
      .then(setData)
      .catch(() => {});
  };
  useEffect(load, []);

  const refresh = async () => {
    setBusy(true);
    try {
      await api.refreshSuggestions();
      load();
    } finally {
      setBusy(false);
    }
  };

  const empty = data.classic.length === 0 && data.recent.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">あなたへの提案</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          {busy ? "更新中…" : "更新"}
        </button>
      </div>

      {empty && (
        <p className="py-16 text-center text-stone-400">
          まだ提案がありません。「更新」を押すか、論文を取り込むと提案が生成されます。
        </p>
      )}

      {data.classic.length > 0 && <Group title="定番" items={data.classic} onAction={load} />}
      {data.recent.length > 0 && <Group title="最新" items={data.recent} onAction={load} />}
    </main>
  );
}

function Group({
  title,
  items,
  onAction,
}: {
  title: string;
  items: Suggestion[];
  onAction: () => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id} s={s} onAction={onAction} />
        ))}
      </div>
    </section>
  );
}
