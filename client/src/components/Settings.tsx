import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { api } from "../lib/api";
import { cx } from "../lib/cx";
import {
  IconBan,
  IconBuilding,
  IconCap,
  IconCheck,
  IconGlobe,
  IconSpinner,
  IconTag,
  IconTarget,
} from "../lib/icons";
import type { OutputLang } from "../types";
import { Button, Segmented } from "./ui";

const LEVELS = ["", "初級", "中級", "上級"];
const READABILITY = ["", "やさしめ", "標準", "詳しめ"];
const HOURS = Array.from({ length: 24 }, (_, h) => h); // 0..23 (JST), for the cron-time select

type Accent = "primary" | "accent" | "success" | "danger";
const CHIP: Record<Accent, string> = {
  primary: "bg-primary-soft text-primary-ink ring-primary/20",
  accent: "bg-accent-soft text-accent-ink ring-accent/25",
  success: "bg-success-soft text-success ring-success/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
};

export function Settings() {
  const [interests, setInterests] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [readability, setReadability] = useState("");
  const [outputLang, setOutputLang] = useState<OutputLang>("ja");
  const [suggestHour, setSuggestHour] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        if (p) {
          setInterests(p.interests);
          setDomains(p.domains);
          setOrganizations(p.organizations);
          setAvoid(p.avoid);
          setGoal(p.goal ?? "");
          setLevel(p.level ?? "");
          setReadability(p.readability ?? "");
          setOutputLang(p.outputLang);
          setSuggestHour(p.suggestHour);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dirtyReset = () => setSaved(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await api.updateProfile({
        interests,
        domains,
        organizations,
        avoid,
        goal: goal.trim() || null,
        level: level || null,
        readability: readability || null,
        outputLang,
        suggestHour,
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-7 sm:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-muted">
            プロフィールを設定すると、提案（Suggestions）があなた向けに最適化されます。
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-ink-faint">
            <IconSpinner className="text-[1.2rem]" /> 読み込み中…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Basics */}
            <Card title="基本設定" icon={<IconGlobe />}>
              <Row label="AI 出力の言語">
                <Segmented
                  value={outputLang}
                  onChange={(v) => {
                    setOutputLang(v);
                    dirtyReset();
                  }}
                  options={[
                    { value: "ja", label: "日本語" },
                    { value: "en", label: "English" },
                  ]}
                />
              </Row>
              <Row label="レベル感">
                <ChoiceRow
                  options={LEVELS}
                  value={level}
                  onChange={(v) => {
                    setLevel(v);
                    dirtyReset();
                  }}
                />
              </Row>
              <Row label="読みやすさ">
                <ChoiceRow
                  options={READABILITY}
                  value={readability}
                  onChange={(v) => {
                    setReadability(v);
                    dirtyReset();
                  }}
                />
              </Row>
              <Row label="提案の自動更新時刻 (JST)">
                <select
                  value={suggestHour === null ? "" : String(suggestHour)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSuggestHour(v === "" ? null : Number(v));
                    dirtyReset();
                  }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none"
                >
                  <option value="">おまかせ（07:00）</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {`${String(h).padStart(2, "0")}:00`}
                    </option>
                  ))}
                </select>
              </Row>
            </Card>

            {/* Personalization tags (Discord-style server tags) */}
            <Card
              title="パーソナライズタグ"
              icon={<IconTag />}
              hint="提案の入力に使われます。Enter / カンマで追加。"
            >
              <TagField
                label="興味トピック"
                icon={<IconTag />}
                accent="primary"
                values={interests}
                onChange={(v) => {
                  setInterests(v);
                  dirtyReset();
                }}
                placeholder="例: transformers, RLHF, 拡散モデル"
              />
              <TagField
                label="分野・学問領域"
                icon={<IconCap />}
                accent="success"
                values={domains}
                onChange={(v) => {
                  setDomains(v);
                  dirtyReset();
                }}
                placeholder="例: 自然言語処理, コンピュータビジョン"
              />
              <TagField
                label="気になる企業・研究機関"
                icon={<IconBuilding />}
                accent="accent"
                values={organizations}
                onChange={(v) => {
                  setOrganizations(v);
                  dirtyReset();
                }}
                placeholder="例: OpenAI, DeepMind, Anthropic"
              />
              <TagField
                label="避けたいトピック"
                icon={<IconBan />}
                accent="danger"
                values={avoid}
                onChange={(v) => {
                  setAvoid(v);
                  dirtyReset();
                }}
                placeholder="例: ブロックチェーン"
              />
            </Card>

            {/* Goal */}
            <Card
              title="研究・学習の目的"
              icon={<IconTarget />}
              hint="自由記述。提案の文脈に使われます。"
            >
              <textarea
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  dirtyReset();
                }}
                rows={3}
                maxLength={500}
                placeholder="例: LLM の学習効率に関する最新手法を追いたい。実装に落とせる論文を優先。"
                className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-3 text-[0.9rem] leading-6 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 placeholder:text-ink-faint"
              />
            </Card>

            {/* Save */}
            <div className="sticky bottom-0 -mx-1 flex items-center gap-3 bg-paper/80 px-1 py-3 backdrop-blur">
              <Button variant="primary" size="lg" onClick={save} disabled={busy}>
                {busy ? <IconSpinner /> : <IconCheck />}
                {busy ? "保存中…" : "保存"}
              </Button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <IconCheck /> 保存しました
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-[1.05rem] text-primary-ink">
          {icon}
        </span>
        <h2 className="text-[0.98rem] font-semibold text-ink">{title}</h2>
        {hint && <span className="text-[0.74rem] text-ink-faint">{hint}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o, label: o || "おまかせ" }))}
    />
  );
}

function TagField({
  label,
  icon,
  accent,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  icon: ReactNode;
  accent: Accent;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[0.82rem] font-medium text-ink">
        <span className="text-[1rem] text-ink-muted">{icon}</span>
        {label}
        <span className="text-[0.72rem] font-normal text-ink-faint">({values.length})</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2 transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
        {values.map((v, i) => (
          <span
            key={v}
            className={cx(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.78rem] font-medium ring-1 ring-inset",
              CHIP[accent],
            )}
          >
            <span className="text-[0.9em] opacity-70">{icon}</span>
            {v}
            <button
              type="button"
              aria-label={`${v} を削除`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="ml-0.5 rounded opacity-60 transition-opacity hover:opacity-100"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : "追加…"}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-[0.85rem] outline-none placeholder:text-ink-faint"
        />
      </div>
    </div>
  );
}
