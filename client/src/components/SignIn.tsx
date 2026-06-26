import { api } from "../lib/api";
import { BrandMark, GoogleLogo, IconLibrary, IconSparkles, IconWand } from "../lib/icons";

const FEATURES = [
  { icon: <IconLibrary />, title: "自動で整理", body: "投げ込むだけでタグ付け・フォルダ整理。" },
  { icon: <IconWand />, title: "その場で理解", body: "本文を選んでAIに質問・説明。" },
  { icon: <IconSparkles />, title: "次の一本", body: "実データに基づく論文の提案。" },
];

export function SignIn() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-6 py-12 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-[1.7rem] text-white shadow-card">
            <BrandMark />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              eyday<span className="text-primary">·paper</span>
            </h1>
            <p className="text-sm text-ink-muted">論文を読むハードルを下げる</p>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-7 shadow-pop">
          <h2 className="text-[1.15rem] font-semibold text-ink">ようこそ</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">
            リンクや PDF を投げ込むと、自動で整理・蓄積し、AI
            が「探す・理解する・次に読む」を支援します。
          </p>

          <button
            type="button"
            onClick={() => api.signInGoogle()}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-[0.95rem] font-medium text-ink shadow-card transition-colors hover:bg-surface-muted"
          >
            <GoogleLogo className="text-[1.25rem]" />
            Google で続ける
          </button>

          <div className="mt-7 space-y-3 border-t border-line pt-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-[1.1rem] text-primary-ink">
                  {f.icon}
                </span>
                <div>
                  <p className="text-[0.88rem] font-medium text-ink">{f.title}</p>
                  <p className="text-[0.8rem] text-ink-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[0.72rem] text-ink-faint">
          サインインすると、利用規約とプライバシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
