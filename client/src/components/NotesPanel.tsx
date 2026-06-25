import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Note } from "../types";

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
    <section className="mt-10 border-t border-stone-200 pt-8 font-sans">
      <h2 className="mb-3 text-lg font-semibold">メモ</h2>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="メモを追加…"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 outline-none focus:border-amber-600"
        />
        <button
          type="submit"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-100"
        >
          追加
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {notes.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3"
          >
            <span className="whitespace-pre-wrap text-sm text-stone-800">{n.body}</span>
            <button
              type="button"
              onClick={() => remove(n.id)}
              className="shrink-0 text-xs text-stone-400 hover:text-rose-600"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
