import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { cx } from "../lib/cx";
import {
  IconArrowLeft,
  IconBookOpen,
  IconChat,
  IconCheckCircle,
  IconCircle,
  IconClose,
  IconDoc,
  IconNote,
  IconQuote,
  IconSpinner,
  IconWand,
} from "../lib/icons";
import { ResizeHandle, useResizable } from "../lib/resizable";
import { useMediaQuery } from "../lib/useMediaQuery";
import type { ExtractedDoc, Folder, OutputLang, Paper, PaperStatus, Tag } from "../types";
import { ChatPane, type SelectionContext } from "./ChatPane";
import { NotesPanel } from "./NotesPanel";
import { SummaryBox } from "./SummaryBox";
import { IconButton, Segmented } from "./ui";

const STATUS_OPTIONS: { value: PaperStatus; label: string; icon: React.ReactNode }[] = [
  { value: "unread", label: "未読", icon: <IconCircle /> },
  { value: "reading", label: "読書中", icon: <IconBookOpen /> },
  { value: "read", label: "読了", icon: <IconCheckCircle /> },
];

interface Detail {
  paper: Paper;
  tags: Tag[];
  folder: Folder | null;
}

interface KeyedDoc {
  sections: { key: string; heading: string | null; paragraphs: { key: string; text: string }[] }[];
}

interface Popover {
  text: string;
  section: string | null;
  x: number;
  y: number;
}

const keyDoc = (doc: ExtractedDoc): KeyedDoc => ({
  sections: doc.sections.map((s, i) => ({
    key: `s${i}`,
    heading: s.heading,
    paragraphs: s.paragraphs.map((text, j) => ({ key: `s${i}p${j}`, text })),
  })),
});

export function Reader({ paperId, onBack }: { paperId: string; onBack: () => void }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [doc, setDoc] = useState<KeyedDoc | null | undefined>(undefined);
  const [showPdf, setShowPdf] = useState(false);
  const [lang, setLang] = useState<OutputLang>("ja");
  const [paneOpen, setPaneOpen] = useState(false);
  const [paneTab, setPaneTab] = useState<"chat" | "notes">("chat");
  const [context, setContext] = useState<SelectionContext | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);

  const pane = useResizable({
    storageKey: "eyday.reader.pane.w",
    initial: 384,
    min: 312,
    max: 620,
    anchor: "right",
  });

  useEffect(() => {
    setDoc(undefined);
    setPopover(null);
    setContext(null);
    api
      .getPaper(paperId)
      .then(setDetail)
      .catch(() => setDetail(null));
    api
      .getText(paperId)
      .then((d) => setDoc(d ? keyDoc(d) : null))
      .catch(() => setDoc(null));
  }, [paperId]);

  const askAbout = useCallback((ctx: SelectionContext) => {
    setContext(ctx);
    setPaneTab("chat");
    setPaneOpen(true);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const onMouseUp = useCallback(() => {
    if (showPdf) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || text.length < 2) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const sectionEl = (selection.anchorNode?.parentElement?.closest("[data-section]") ??
      null) as HTMLElement | null;
    setPopover({
      text,
      section: sectionEl?.dataset.section || null,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, [showPdf]);

  const paper = detail?.paper;

  const changeStatus = async (status: PaperStatus) => {
    await api.setStatus(paperId, status);
    setDetail((d) => (d ? { ...d, paper: { ...d.paper, status } } : d));
  };

  const openPane = (tab: "chat" | "notes") => {
    setPaneTab(tab);
    setPaneOpen(true);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Reading column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <IconArrowLeft className="text-[1.1rem]" />
            <span className="hidden sm:inline">一覧へ</span>
          </button>
          <div className="flex-1" />
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: "ja", label: "JA" },
              { value: "en", label: "EN" },
            ]}
          />
          {paper?.pdfR2Key && (
            <button
              type="button"
              onClick={() => setShowPdf((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[0.8rem] font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              {showPdf ? (
                <IconBookOpen className="text-[1.05rem]" />
              ) : (
                <IconDoc className="text-[1.05rem]" />
              )}
              <span className="hidden sm:inline">{showPdf ? "リフロー本文" : "原文 PDF"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (paneOpen ? setPaneOpen(false) : openPane("chat"))}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
              paneOpen
                ? "bg-primary text-white hover:bg-primary-hover"
                : "border border-line bg-surface text-ink hover:bg-surface-muted",
            )}
          >
            <IconChat className="text-[1.05rem]" />
            <span className="hidden sm:inline">AI に質問</span>
          </button>
        </header>

        {/* Scrollable reading content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-5 py-7 sm:px-8">
            {detail && paper && (
              <header className="mb-7">
                <h1 className="font-serif text-[1.7rem] font-semibold leading-snug tracking-tight text-ink">
                  {paper.title}
                </h1>
                <p className="mt-2 text-sm text-ink-muted">
                  {paper.authors.join(", ") || "—"}
                  {paper.year ? ` · ${paper.year}` : ""}
                  {paper.venue ? ` · ${paper.venue}` : ""}
                </p>
                {detail.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {detail.tags.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.72rem] font-medium text-accent-ink"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Segmented
                    value={paper.status}
                    onChange={changeStatus}
                    options={STATUS_OPTIONS}
                  />
                </div>
              </header>
            )}

            {showPdf && paper?.pdfR2Key ? (
              <object
                data={api.pdfUrl(paperId)}
                type="application/pdf"
                className="h-[78vh] w-full rounded-xl border border-line"
                aria-label="original PDF"
              >
                <a href={api.pdfUrl(paperId)} className="text-primary underline">
                  PDF を開く
                </a>
              </object>
            ) : (
              <>
                <SummaryBox paperId={paperId} lang={lang} />
                <article onMouseUp={onMouseUp} onTouchEnd={onMouseUp} className="reading mt-7">
                  {doc === undefined && (
                    <p className="flex items-center gap-2 text-ink-faint">
                      <IconSpinner className="text-[1.1rem]" /> 読み込み中…
                    </p>
                  )}
                  {doc === null && (
                    <p className="text-ink-faint">
                      本文を処理中です。原文 PDF は上のボタンから開けます。
                    </p>
                  )}
                  {doc?.sections.map((section) => (
                    <section
                      key={section.key}
                      data-section={section.heading ?? ""}
                      className="mb-2"
                    >
                      {section.heading && (
                        <h2 className="mb-3 mt-7 font-sans text-[1.15rem] font-semibold text-ink">
                          {section.heading}
                        </h2>
                      )}
                      {section.paragraphs.map((p) => (
                        <div key={p.key} className="group relative">
                          <button
                            type="button"
                            aria-label="この段落について質問"
                            onClick={() => askAbout({ text: p.text, section: section.heading })}
                            className="absolute -left-9 top-1 hidden h-7 w-7 place-items-center rounded-lg border border-line bg-surface text-ink-muted opacity-0 shadow-card transition-opacity hover:text-primary group-hover:opacity-100 lg:grid"
                          >
                            <IconQuote className="text-[1rem]" />
                          </button>
                          <p>{p.text}</p>
                        </div>
                      ))}
                    </section>
                  ))}
                </article>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle (desktop, pane open) */}
      {paneOpen && isDesktop && (
        <ResizeHandle
          anchor="right"
          label="チャットパネルの幅を変更"
          onPointerDown={pane.onPointerDown}
          onNudge={pane.nudge}
        />
      )}

      {/* Right pane: Chat / Notes */}
      {paneOpen && (
        <aside
          style={isDesktop ? { width: pane.width } : undefined}
          className={cx(
            "flex min-h-0 flex-col bg-surface",
            isDesktop ? "shrink-0 border-l border-line" : "fixed inset-0 z-40 animate-fade",
          )}
        >
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2">
            <PaneTab
              active={paneTab === "chat"}
              onClick={() => setPaneTab("chat")}
              icon={<IconChat />}
              label="チャット"
            />
            <PaneTab
              active={paneTab === "notes"}
              onClick={() => setPaneTab("notes")}
              icon={<IconNote />}
              label="メモ"
            />
            <div className="flex-1" />
            <IconButton label="閉じる" size="sm" onClick={() => setPaneOpen(false)}>
              <IconClose />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1">
            {paneTab === "chat" ? (
              <ChatPane
                paperId={paperId}
                lang={lang}
                context={context}
                onClearContext={() => setContext(null)}
              />
            ) : (
              <NotesPanel paperId={paperId} />
            )}
          </div>
        </aside>
      )}

      {/* Selection popover */}
      {popover && !showPdf && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full animate-pop"
          style={{
            left: Math.min(Math.max(popover.x, 90), window.innerWidth - 90),
            top: Math.max(popover.y - 8, 44),
          }}
        >
          <button
            type="button"
            onClick={() => askAbout({ text: popover.text, section: popover.section })}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[0.8rem] font-medium text-white shadow-pop transition-transform hover:scale-[1.03]"
          >
            <IconWand className="text-[1rem]" />
            チャットで質問
          </button>
        </div>
      )}
    </div>
  );
}

function PaneTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-ink"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      <span className="text-[1.05rem]">{icon}</span>
      {label}
    </button>
  );
}
