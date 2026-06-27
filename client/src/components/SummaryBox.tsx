import { useState } from "react";
import { IconChevronDown, IconChevronRight, IconSparkles, IconSpinner } from "../lib/icons";
import { summaryStore, useSummary } from "../lib/summaryStore";
import type { OutputLang } from "../types";
import { Markdown } from "./Markdown";

/**
 * TL;DR + section summaries, generated on demand and cached per language. State
 * lives in summaryStore so "生成中…" survives navigating away and back (and the
 * result is cached client-side), matching the suggestions refresh UX.
 */
export function SummaryBox({ paperId, lang }: { paperId: string; lang: OutputLang }) {
  const { status, summary } = useSummary(paperId, lang);
  const [open, setOpen] = useState(false);
  const busy = status === "generating";
  const error = status === "error";

  const load = () => summaryStore.generate(paperId, lang);

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary-softer">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-[1.05rem] text-white">
          <IconSparkles />
        </span>
        <h2 className="flex-1 text-[0.9rem] font-semibold text-primary-ink">要約 (TL;DR)</h2>
        {!summary && (
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <IconSpinner /> : <IconSparkles />}
            {busy ? "生成中…" : "生成する"}
          </button>
        )}
      </div>

      {error && (
        <p className="px-4 pb-3 text-[0.8rem] text-danger">
          要約を生成できませんでした（本文の処理完了が必要です）。
        </p>
      )}

      {summary && (
        <div className="border-t border-primary/12 bg-surface/60 px-4 py-3">
          <div className="text-[0.95rem] leading-7 text-ink">
            <Markdown>{summary.tldr}</Markdown>
          </div>
          {summary.sections.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-primary-ink hover:underline"
              >
                {open ? <IconChevronDown /> : <IconChevronRight />}
                セクション要約
              </button>
              {open && (
                <ul className="mt-2 space-y-2 border-l-2 border-primary/15 pl-3">
                  {summary.sections.map((s) => (
                    <li
                      key={(s.heading ?? "") + s.summary.slice(0, 24)}
                      className="text-[0.84rem] leading-6 text-ink-muted"
                    >
                      {s.heading && <span className="font-semibold text-ink">{s.heading}: </span>}
                      <Markdown>{s.summary}</Markdown>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
