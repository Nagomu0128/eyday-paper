import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { IconNote, IconTrash } from "../lib/icons";
import type { Note } from "../types";
import { EmptyState } from "./ui";

/** Notes/highlights for a paper. Content-only (lives in the reader's right pane). */
export function NotesPanel({ paperId }: { paperId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");

  const load = () => {
    api
      .getNotes(paperId)
      .then(setNotes)
      .catch(() => {});
  };
  useEffect(load, [paperId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const b = body.trim();
    if (!b) return;
    await api.addNote(paperId, b);
    setBody("");
    load();
  };

  const remove = async (id: string) => {
    await api.deleteNote(id);
    load();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {notes.length === 0 ? (
          <EmptyState
            icon={<IconNote />}
            title="メモはまだありません"
            description="読みながら気づきや疑問を書き留めましょう。"
          />
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card"
            >
              <span className="whitespace-pre-wrap text-[0.85rem] leading-6 text-ink">
                {n.body}
              </span>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label="削除"
                className="shrink-0 rounded-md p-1 text-ink-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
              >
                <IconTrash className="text-[1rem]" />
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={add} className="border-t border-line bg-surface-muted/40 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="メモを追加…"
            className="h-9 flex-1 bg-transparent px-2 text-[0.875rem] outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!body.trim()}
            aria-label="追加"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-[1.2rem] text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            +
          </button>
        </div>
      </form>
    </div>
  );
}
