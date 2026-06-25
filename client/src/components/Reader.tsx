import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type {
  Explanation,
  ExtractedDoc,
  Folder,
  OutputLang,
  Paper,
  PaperStatus,
  Tag,
} from "../types";
import { NotesPanel } from "./NotesPanel";
import { QaPanel } from "./QaPanel";
import { SummaryBox } from "./SummaryBox";

const STATUSES: { value: PaperStatus; label: string }[] = [
  { value: "unread", label: "未読" },
  { value: "reading", label: "読書中" },
  { value: "read", label: "読了" },
];

interface Detail {
  paper: Paper;
  tags: Tag[];
  folder: Folder | null;
}

interface KeyedDoc {
  sections: {
    key: string;
    heading: string | null;
    paragraphs: { key: string; text: string }[];
  }[];
}

interface Selection {
  text: string;
  section: string | null;
  x: number;
  y: number;
}

// Stable keys computed once (extracted content never reorders).
const keyDoc = (doc: ExtractedDoc): KeyedDoc => ({
  sections: doc.sections.map((s, i) => ({
    key: `s${i}`,
    heading: s.heading,
    paragraphs: s.paragraphs.map((text, j) => ({ key: `s${i}p${j}`, text })),
  })),
});

export function Reader({ paperId, onBack }: { paperId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [doc, setDoc] = useState<KeyedDoc | null | undefined>(undefined);
  const [showPdf, setShowPdf] = useState(false);
  const [lang, setLang] = useState<OutputLang>("ja");
  const [sel, setSel] = useState<Selection | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    setDoc(undefined);
    setSel(null);
    setExplanation(null);
    api
      .getPaper(paperId)
      .then(setDetail)
      .catch(() => setDetail(null));
    api
      .getText(paperId)
      .then((d) => setDoc(d ? keyDoc(d) : null))
      .catch(() => setDoc(null));
  }, [paperId]);

  const onMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || text.length < 2) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const sectionEl = (selection.anchorNode?.parentElement?.closest("[data-section]") ??
      null) as HTMLElement | null;
    setExplanation(null);
    setSel({
      text,
      section: sectionEl?.dataset.section || null,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
  }, []);

  const runExplain = async () => {
    if (!sel) return;
    setExplaining(true);
    try {
      const res = await api.explain(paperId, {
        selectedText: sel.text,
        section: sel.section ?? undefined,
        lang,
      });
      setExplanation(res);
    } catch {
      setExplanation({
        explanation: "説明の生成に失敗しました。",
        source: { section: null, page: null },
      });
    } finally {
      setExplaining(false);
    }
  };

  const paper = detail?.paper;

  const changeStatus = async (status: PaperStatus) => {
    await api.setStatus(paperId, status);
    setDetail((d) => (d ? { ...d, paper: { ...d.paper, status } } : d));
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← 一覧へ
        </button>
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} onChange={setLang} />
          {paper?.pdfR2Key && (
            <button
              type="button"
              onClick={() => setShowPdf((v) => !v)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              {showPdf ? "リフロー本文" : "原文 PDF"}
            </button>
          )}
        </div>
      </div>

      {detail && paper && (
        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-semibold leading-snug tracking-tight">{paper.title}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {paper.authors.join(", ") || "—"}
            {paper.year ? ` · ${paper.year}` : ""}
          </p>
          {detail.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detail.tags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex w-fit overflow-hidden rounded-lg border border-stone-300 font-sans text-sm">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => changeStatus(s.value)}
                className={
                  s.value === paper.status
                    ? "bg-stone-900 px-3 py-1.5 text-white"
                    : "bg-white px-3 py-1.5 text-stone-600 hover:bg-stone-100"
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>
      )}

      {showPdf && paper?.pdfR2Key ? (
        <object
          data={api.pdfUrl(paperId)}
          type="application/pdf"
          className="h-[80vh] w-full rounded-lg border border-stone-200"
          aria-label="original PDF"
        >
          <a href={api.pdfUrl(paperId)} className="text-amber-700 underline">
            PDF を開く
          </a>
        </object>
      ) : (
        <article
          onMouseUp={onMouseUp}
          className="space-y-6 font-serif text-[1.05rem] leading-8 text-stone-800"
        >
          <SummaryBox paperId={paperId} lang={lang} />
          {doc === undefined && <p className="text-stone-400">読み込み中…</p>}
          {doc === null && (
            <p className="text-stone-400">本文を処理中です。原文 PDF は上のボタンから開けます。</p>
          )}
          {doc?.sections.map((section) => (
            <section key={section.key} data-section={section.heading ?? ""}>
              {section.heading && (
                <h2 className="mb-2 font-sans text-lg font-semibold text-stone-900">
                  {section.heading}
                </h2>
              )}
              {section.paragraphs.map((p) => (
                <p key={p.key} className="mb-4">
                  {p.text}
                </p>
              ))}
            </section>
          ))}
          <QaPanel paperId={paperId} lang={lang} />
          <NotesPanel paperId={paperId} />
        </article>
      )}

      {sel && !showPdf && (
        <ExplainPopover
          sel={sel}
          explaining={explaining}
          explanation={explanation}
          onExplain={runExplain}
          onClose={() => {
            setSel(null);
            setExplanation(null);
          }}
        />
      )}
    </main>
  );
}

function LangToggle({ lang, onChange }: { lang: OutputLang; onChange: (l: OutputLang) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-stone-300 text-sm">
      {(["ja", "en"] as const).map((l) => (
        <button
          type="button"
          key={l}
          onClick={() => onChange(l)}
          className={
            l === lang
              ? "bg-amber-700 px-3 py-1.5 text-white"
              : "bg-white px-3 py-1.5 text-stone-600"
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ExplainPopover({
  sel,
  explaining,
  explanation,
  onExplain,
  onClose,
}: {
  sel: Selection;
  explaining: boolean;
  explanation: Explanation | null;
  onExplain: () => void;
  onClose: () => void;
}) {
  const left = Math.min(Math.max(sel.x, 180), window.innerWidth - 180);
  const top = Math.min(sel.y + 8, window.innerHeight - 60);
  return (
    <div className="fixed z-20 -translate-x-1/2" style={{ left, top }}>
      {!explanation && !explaining && (
        <button
          type="button"
          onClick={onExplain}
          className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white shadow-lg"
        >
          ここを説明
        </button>
      )}
      {(explaining || explanation) && (
        <div className="w-80 max-w-[90vw] rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
          {explaining ? (
            <p className="text-sm text-stone-400">説明を生成中…</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">
                {explanation?.explanation}
              </p>
              {explanation?.source.section && (
                <p className="mt-2 text-xs text-stone-400">出典: {explanation.source.section}</p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-xs text-stone-400 hover:text-stone-700"
              >
                閉じる
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
