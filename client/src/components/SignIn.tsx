import { api } from "../lib/api";

export function SignIn() {
  return (
    <div className="grid min-h-dvh place-items-center bg-stone-50 px-6 text-stone-900">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            eyday<span className="text-amber-700">-paper</span>
          </h1>
          <p className="mt-3 text-stone-500">論文を読むハードルを下げる</p>
        </div>
        <button
          type="button"
          onClick={() => api.signInGoogle()}
          className="inline-flex items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-6 py-3 font-medium text-stone-800 shadow-sm transition hover:bg-stone-100"
        >
          <span className="text-amber-700">G</span> Sign in with Google
        </button>
        <p className="text-xs text-stone-400">
          リンクや PDF を投げ込むと、自動で整理・蓄積し、AI が読むのを助けます。
        </p>
      </div>
    </div>
  );
}
