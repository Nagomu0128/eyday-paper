import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  IconChevronDown,
  IconClock,
  IconPlus,
  IconQuote,
  IconSend,
  IconSpinner,
  IconTrash,
  IconWand,
} from "../lib/icons";
import type { OutputLang, QaMessage, QaSession } from "../types";
import { Markdown } from "./Markdown";

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

const toChatMsg = (m: QaMessage): ChatMsg => ({ id: m.id, role: m.role, content: m.content });

/**
 * Cursor-style chat about the paper. A text selection (or paragraph tap) becomes
 * a quoted context chip; sending with only a quote runs explain-on-selection,
 * while a typed question runs grounded RAG Q&A. Q&A turns persist to a session
 * (thread), so closing the pane keeps the conversation — and the user can keep
 * several threads and browse history. (Explain-on-selection stays ephemeral.)
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
  const [sessions, setSessions] = useState<QaSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  // Load threads + the most recent thread's messages when the paper changes, so
  // reopening the pane restores the conversation.
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setSessionId(null);
    setHistOpen(false);
    api
      .listQaSessions(paperId)
      .then(async (ss) => {
        if (cancelled) return;
        setSessions(ss);
        const latest = ss[0];
        if (latest) {
          setSessionId(latest.id);
          const msgs = await api.getSessionMessages(latest.id).catch(() => []);
          if (!cancelled) {
            setMessages(msgs.map(toChatMsg));
            scrollDown();
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [paperId, scrollDown]);

  const refreshSessions = () => {
    api
      .listQaSessions(paperId)
      .then(setSessions)
      .catch(() => {});
  };

  const switchSession = async (id: string) => {
    setHistOpen(false);
    if (id === sessionId) return;
    setSessionId(id);
    const msgs = await api.getSessionMessages(id).catch(() => []);
    setMessages(msgs.map(toChatMsg));
    scrollDown();
  };

  const newChat = () => {
    setHistOpen(false);
    setSessionId(null);
    setMessages([]);
    onClearContext();
  };

  const deleteSession = async (id: string) => {
    await api.deleteQaSession(id).catch(() => {});
    const ss = await api.listQaSessions(paperId).catch(() => []);
    setSessions(ss);
    if (id === sessionId) {
      const next = ss[0];
      if (next) {
        setSessionId(next.id);
        setMessages((await api.getSessionMessages(next.id).catch(() => [])).map(toChatMsg));
      } else {
        setSessionId(null);
        setMessages([]);
      }
    }
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
        // Explain-on-selection: a one-off, not part of a saved thread.
        const r = await api.explain(paperId, {
          selectedText: quote,
          section: context?.section ?? undefined,
          lang,
        });
        settle({ content: r.explanation, sources: [r.source] });
      } else {
        const question = quote ? `選択箇所:「${quote}」\n\n${trimmed}` : trimmed;
        const r = await api.askQuestion(paperId, question, lang, sessionId ?? undefined);
        settle({ content: r.answer, sources: r.citations, grounded: r.grounded });
        if (!sessionId && r.sessionId) setSessionId(r.sessionId);
        refreshSessions(); // pick up the new/renamed thread + re-sort by recency
      }
    } catch (err) {
      const limited = err instanceof Error && err.message.includes("429");
      settle({
        content: limited
          ? "本日の質問回数の上限に達しました。明日また利用できます。"
          : "生成に失敗しました。少し待って再度お試しください。",
        grounded: false,
      });
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

  const currentTitle = sessions.find((s) => s.id === sessionId)?.title ?? "新しいチャット";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread bar: history switcher + new chat */}
      <div className="relative flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => setHistOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.78rem] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <IconClock className="text-[0.95rem]" />
          履歴{sessions.length > 0 ? ` (${sessions.length})` : ""}
          <IconChevronDown className="text-[0.85rem]" />
        </button>
        <span className="flex-1 truncate text-center text-[0.78rem] text-ink-faint">
          {currentTitle}
        </span>
        <button
          type="button"
          onClick={newChat}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.78rem] font-medium text-primary transition-colors hover:bg-primary-softer"
        >
          <IconPlus className="text-[0.95rem]" />
          新規
        </button>

        {histOpen && (
          <>
            <button
              type="button"
              aria-label="履歴メニューを閉じる"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setHistOpen(false)}
            />
            <div className="absolute left-2 top-full z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-pop">
              {sessions.length === 0 ? (
                <p className="px-3 py-2 text-[0.78rem] text-ink-faint">
                  まだ会話履歴はありません。
                </p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-1 px-1.5 hover:bg-surface-muted"
                  >
                    <button
                      type="button"
                      onClick={() => switchSession(s.id)}
                      className={cxActive(s.id === sessionId)}
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      aria-label="この会話を削除"
                      className="shrink-0 rounded-md p-1 text-ink-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                    >
                      <IconTrash className="text-[0.9rem]" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-[1.5rem] text-primary">
              <IconWand />
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
                  <div className="text-[0.875rem] leading-6 text-ink">
                    <Markdown>{m.content}</Markdown>
                  </div>
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

const cxActive = (active: boolean): string =>
  `flex-1 truncate rounded-md px-2 py-1.5 text-left text-[0.8rem] ${
    active ? "font-medium text-primary" : "text-ink-muted"
  }`;
