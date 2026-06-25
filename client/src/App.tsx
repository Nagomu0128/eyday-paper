import { useEffect, useState } from "react";
import { Library } from "./components/Library";
import { Reader } from "./components/Reader";
import { Settings } from "./components/Settings";
import { SignIn } from "./components/SignIn";
import { Suggestions } from "./components/Suggestions";
import { api } from "./lib/api";

type View =
  | { name: "library" }
  | { name: "suggestions" }
  | { name: "settings" }
  | { name: "reader"; paperId: string };
type Auth = "loading" | "in" | "out";

const navClass = (active: boolean) =>
  active ? "font-medium text-stone-900" : "text-stone-500 hover:text-stone-800";

export default function App() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [view, setView] = useState<View>({ name: "library" });

  useEffect(() => {
    api
      .me()
      .then((m) => setAuth(m ? "in" : "out"))
      .catch(() => setAuth("out"));
  }, []);

  if (auth === "loading") {
    return <div className="grid min-h-dvh place-items-center bg-stone-50 text-stone-400">…</div>;
  }
  if (auth === "out") return <SignIn />;

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => setView({ name: "library" })}
            className="font-semibold tracking-tight"
          >
            eyday<span className="text-amber-700">-paper</span>
          </button>
          <nav className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => setView({ name: "library" })}
              className={navClass(view.name === "library")}
            >
              ライブラリ
            </button>
            <button
              type="button"
              onClick={() => setView({ name: "suggestions" })}
              className={navClass(view.name === "suggestions")}
            >
              提案
            </button>
            <button
              type="button"
              onClick={() => setView({ name: "settings" })}
              className={navClass(view.name === "settings")}
            >
              設定
            </button>
            <button
              type="button"
              onClick={() => api.signOut()}
              className="text-stone-400 hover:text-stone-700"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      {view.name === "library" && (
        <Library onOpen={(paperId) => setView({ name: "reader", paperId })} />
      )}
      {view.name === "suggestions" && <Suggestions />}
      {view.name === "settings" && <Settings />}
      {view.name === "reader" && (
        <Reader paperId={view.paperId} onBack={() => setView({ name: "library" })} />
      )}
    </div>
  );
}
