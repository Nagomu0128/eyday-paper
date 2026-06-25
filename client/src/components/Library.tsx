import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Paper } from "../types";

const STATUS_LABEL: Record<Paper["status"], string> = {
  unread: "未読",
  reading: "読書中",
  read: "読了",
};

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .listPapers()
      .then(setPapers)
      .catch(() => setError("一覧の取得に失敗しました"));
  };
  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await api.ingest(value);
      setInput("");
      load();
    } catch {
      setError("取り込みに失敗しました。arXiv ID / DOI / URL を確認してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="arXiv ID / DOI / URL を貼り付け（例: 1706.03762）"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 outline-none focus:border-amber-600"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-700 px-5 py-2.5 font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
        >
          {busy ? "取り込み中…" : "取り込む"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {papers.length > 0 && (
        <div className="mt-6 flex gap-4 text-sm text-stone-500">
          <span>
            全 <span className="font-semibold text-stone-800">{papers.length}</span> 件
          </span>
          <span>未読 {papers.filter((p) => p.status === "unread").length}</span>
          <span>読書中 {papers.filter((p) => p.status === "reading").length}</span>
          <span>読了 {papers.filter((p) => p.status === "read").length}</span>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {papers.length === 0 && (
          <p className="py-16 text-center text-stone-400">
            まだ論文がありません。上のバーから取り込んでください。
          </p>
        )}
        {papers.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-300 hover:shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-medium leading-snug">{p.title}</h2>
              <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                {STATUS_LABEL[p.status]}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-stone-500">
              {p.authors.join(", ") || "—"}
              {p.year ? ` · ${p.year}` : ""}
              {p.arxivId ? ` · arXiv:${p.arxivId}` : ""}
            </p>
          </button>
        ))}
      </div>
    </main>
  );
}
