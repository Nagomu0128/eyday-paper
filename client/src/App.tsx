import { useEffect, useState } from "react";
import { Library } from "./components/Library";
import { Reader } from "./components/Reader";
import { SignIn } from "./components/SignIn";
import { api } from "./lib/api";

type View = { name: "library" } | { name: "reader"; paperId: string };
type Auth = "loading" | "in" | "out";

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
          <button
            type="button"
            onClick={() => api.signOut()}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {view.name === "library" ? (
        <Library onOpen={(paperId) => setView({ name: "reader", paperId })} />
      ) : (
        <Reader paperId={view.paperId} onBack={() => setView({ name: "library" })} />
      )}
    </div>
  );
}
