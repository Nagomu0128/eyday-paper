import { type FormEvent, useState } from "react";
import { api } from "../lib/api";
import type { Answer, OutputLang } from "../types";

export function QaPanel({ paperId, lang }: { paperId: string; lang: OutputLang }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await api.askQuestion(paperId, q, lang));
    } catch {
      setAnswer({ answer: "回答の生成に失敗しました。", grounded: false, citations: [] });
    } finally {
      setBusy(false);
    }
  };

  const cited = answer?.citations
    .map((c) => c.section)
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-12 border-t border-stone-200 pt-8 font-sans">
      <h2 className="mb-3 text-lg font-semibold">この論文に質問する</h2>
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例: 提案手法の新規性は？"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 outline-none focus:border-amber-600"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "…" : "質問"}
        </button>
      </form>

      {answer && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
          <p className="whitespace-pre-wrap leading-7 text-stone-800">{answer.answer}</p>
          {cited && <p className="mt-3 text-xs text-stone-400">出典: {cited}</p>}
          {!answer.grounded && (
            <p className="mt-2 text-xs text-amber-700">
              ※ 取得した文脈に根拠が見つかりませんでした。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
