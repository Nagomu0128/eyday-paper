import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { IconChat, IconQuote, IconSend, IconSpinner, IconWand } from "../lib/icons";
import type { OutputLang } from "../types";

export interface SelectionContext {
  text: string;
  section: string | null;
}

interface SourceSpan {
  section: string | null;
  page: number | null;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  quote?: string | null;
  sources?: SourceSpan[];
  grounded?: boolean;
  pending?: boolean;
}

const sourceLabel = (s: SourceSpan): string =>
  [s.section, s.page != null ? `p.${s.page}` : null].filter(Boolean).join(" · ");

/**
 * Cursor-style chat about the paper. A text selection (or paragraph tap) becomes
 * a quoted context chip; sending with only a quote runs explain-on-selection,
 * while a typed question runs grounded RAG Q&A. Answers cite source spans.
 */
export function ChatPane({
  paperId,
  lang,
  context,
  onClearContext,
}: {
  paperId: string;
  lang: OutputLang;
  context: SelectionContext | null;
  onClearContext: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const send = async () => {
    const trimmed = text.trim();
    const quote = context?.text ?? null;
    if (!trimmed && !quote) return;
    if (busy) return;

    setBusy(true);
    const loadingId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: trimmed || "ここを説明して", quote },
      { id: loadingId, role: "assistant", content: "", pending: true },
    ]);
    setText("");
    onClearContext();
    scrollDown();

    const settle = (patch: Partial<ChatMsg>) =>
      setMessages((m) =>
        m.map((msg) => (msg.id === loadingId ? { ...msg, ...patch, pending: false } : msg)),
      );

    try {
      if (quote && !trimmed) {
        const r = await api.explain(paperId, {
          selectedText: quote,
          section: context?.section ?? undefined,
          lang,
        });
        settle({ content: r.explanation, sources: [r.source] });
      } else {
        const question = quote ? `選択箇所:「${quote}」\n\n${trimmed}` : trimmed;
        const r = await api.askQuestion(paperId, question, lang);
        settle({ content: r.answer, sources: r.citations, grounded: r.grounded });
      }
    } catch {
      settle({ content: "生成に失敗しました。少し待って再度お試しください。", grounded: false });
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-[1.5rem] text-primary">
              <IconChat />
            </span>
            <p className="text-sm font-medium text-ink">この論文に質問</p>
            <p className="mt-1 max-w-[16rem] text-[0.8rem] text-ink-muted">
              本文を選択（または段落をタップ）すると引用として質問できます。論文全体への質問もできます。
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="ml-6 rounded-2xl rounded-tr-sm bg-primary-soft px-3.5 py-2.5"
            >
              {m.quote && (
                <div className="mb-1.5 flex gap-1.5 border-l-2 border-primary/40 pl-2 text-[0.78rem] italic text-primary-ink/80">
                  <IconQuote className="mt-0.5 shrink-0 text-[0.9rem] opacity-60" />
                  <span className="line-clamp-3">{m.quote}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-[0.875rem] leading-6 text-primary-ink">
                {m.content}
              </p>
            </div>
          ) : (
            <div
              key={m.id}
              className="mr-6 rounded-2xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 shadow-card"
            >
              {m.pending ? (
                <p className="flex items-center gap-2 text-[0.83rem] text-ink-faint">
                  <IconSpinner className="text-primary" /> 生成中…
                </p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[0.875rem] leading-6 text-ink">
                    {m.content}
                  </p>
                  {m.grounded === false && (
                    <p className="mt-2 text-[0.74rem] text-accent-ink">
                      ※ 取得した文脈に根拠が見つかりませんでした。
                    </p>
                  )}
                  {m.sources && m.sources.filter((s) => s.section || s.page != null).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.sources
                        .filter((s) => s.section || s.page != null)
                        .map((s) => (
                          <span
                            key={sourceLabel(s)}
                            className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-[0.68rem] text-ink-muted ring-1 ring-line"
                          >
                            <IconWand className="text-[0.85em] text-primary" />
                            {sourceLabel(s)}
                          </span>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ),
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface-muted/40 p-3">
        {context && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary-softer px-2.5 py-2 text-[0.78rem] text-primary-ink">
            <IconQuote className="mt-0.5 shrink-0 text-[0.95rem] opacity-70" />
            <span className="line-clamp-2 flex-1 italic">{context.text}</span>
            <button
              type="button"
              onClick={onClearContext}
              className="shrink-0 rounded px-1 text-primary-ink/60 hover:text-primary-ink"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={context ? "この箇所について質問…" : "論文に質問…"}
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-2 text-[0.875rem] outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || (!text.trim() && !context)}
            aria-label="送信"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-[1.1rem] text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {busy ? <IconSpinner /> : <IconSend />}
          </button>
        </div>
      </div>
    </div>
  );
}
