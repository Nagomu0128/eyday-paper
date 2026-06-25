import { useState } from "react";
import { api } from "../lib/api";
import type { OutputLang, Summary } from "../types";

export function SummaryBox({ paperId, lang }: { paperId: string; lang: OutputLang }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(false);
    try {
      setSummary(await api.getSummary(paperId, lang));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50/50 p-5 font-sans">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900">要約 (TL;DR)</h2>
        {!summary && (
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="text-xs text-amber-700 hover:underline disabled:opacity-50"
          >
            {busy ? "生成中…" : "生成する"}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-600">
          要約を生成できませんでした（本文の処理完了が必要です）。
        </p>
      )}
      {summary && (
        <div className="mt-3 space-y-3">
          <p className="leading-7 text-stone-800">{summary.tldr}</p>
          {summary.sections.length > 0 && (
            <details className="text-sm text-stone-600">
              <summary className="cursor-pointer text-amber-800">セクション要約</summary>
              <ul className="mt-2 space-y-1.5">
                {summary.sections.map((s) => (
                  <li key={(s.heading ?? "") + s.summary.slice(0, 24)}>
                    {s.heading && <span className="font-medium text-stone-700">{s.heading}: </span>}
                    {s.summary}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
