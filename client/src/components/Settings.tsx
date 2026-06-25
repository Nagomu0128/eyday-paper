import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { OutputLang } from "../types";

const LEVELS = ["", "初級", "中級", "上級"];
const READABILITY = ["", "やさしめ", "標準", "詳しめ"];

export function Settings() {
  const [interests, setInterests] = useState("");
  const [level, setLevel] = useState("");
  const [readability, setReadability] = useState("");
  const [outputLang, setOutputLang] = useState<OutputLang>("ja");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        if (!p) return;
        setInterests(p.interests.join(", "));
        setLevel(p.level ?? "");
        setReadability(p.readability ?? "");
        setOutputLang(p.outputLang);
      })
      .catch(() => {});
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await api.updateProfile({
        interests: interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        level: level || null,
        readability: readability || null,
        outputLang,
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="mb-6 text-lg font-semibold">設定（プロフィール）</h1>
      <form onSubmit={save} className="space-y-5">
        <Field label="興味のあるトピック（カンマ区切り）">
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="例: transformers, reinforcement learning, NLP"
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 outline-none focus:border-amber-600"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="レベル感">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l || "未設定"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="読みやすさ">
            <select
              value={readability}
              onChange={(e) => setReadability(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5"
            >
              {READABILITY.map((r) => (
                <option key={r} value={r}>
                  {r || "未設定"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-stone-700">AI出力の言語</span>
          <div className="flex w-fit overflow-hidden rounded-lg border border-stone-300 text-sm">
            {(["ja", "en"] as const).map((l) => (
              <button
                type="button"
                key={l}
                onClick={() => setOutputLang(l)}
                className={
                  l === outputLang
                    ? "bg-amber-700 px-4 py-2 text-white"
                    : "bg-white px-4 py-2 text-stone-600"
                }
              >
                {l === "ja" ? "日本語" : "English"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-700 px-5 py-2.5 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存"}
          </button>
          {saved && <span className="text-sm text-emerald-600">保存しました</span>}
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </div>
  );
}
