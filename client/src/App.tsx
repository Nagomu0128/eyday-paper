import { useEffect, useState } from "react";
import { Library } from "./components/Library";
import { Reader } from "./components/Reader";
import { Settings } from "./components/Settings";
import { type NavId, Sidebar } from "./components/Sidebar";
import { SignIn } from "./components/SignIn";
import { Suggestions } from "./components/Suggestions";
import { IconButton } from "./components/ui";
import { api } from "./lib/api";
import { BrandMark, IconMenu, IconSpinner } from "./lib/icons";
import { useSuggestionsStatus } from "./lib/suggestionsStore";
import { useFaviconSpinner } from "./lib/useFaviconSpinner";
import { useMediaQuery } from "./lib/useMediaQuery";
import type { Me } from "./types";

type View = { name: NavId } | { name: "reader"; paperId: string };
type Auth = "loading" | "in" | "out";

const navIdFor = (view: View): NavId => (view.name === "reader" ? "library" : view.name);

export default function App() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>({ name: "library" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { refreshing } = useSuggestionsStatus();

  useEffect(() => {
    api
      .me()
      .then((m) => {
        setMe(m);
        setAuth(m ? "in" : "out");
      })
      .catch(() => setAuth("out"));
  }, []);

  // ⌘/Ctrl+B toggles the sidebar (collapse on desktop, drawer on mobile).
  useEffect(() => {
    if (auth !== "in") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (isDesktop) setCollapsed((v) => !v);
        else setMobileOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auth, isDesktop]);

  // Keep the suggestion spinner visible in the browser tab, even when backgrounded.
  useFaviconSpinner(auth === "in" && refreshing);
  useEffect(() => {
    document.title = refreshing ? "更新中… · eyday-paper" : "eyday-paper";
  }, [refreshing]);

  if (auth === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper text-ink-faint">
        <IconSpinner className="text-[1.5rem] text-primary" />
      </div>
    );
  }
  if (auth === "out") return <SignIn />;

  const go = (name: NavId) => setView({ name });

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <Sidebar
        active={navIdFor(view)}
        onNavigate={go}
        me={me}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/85 px-2.5 backdrop-blur lg:hidden">
          <IconButton label="メニュー" onClick={() => setMobileOpen(true)}>
            <IconMenu />
          </IconButton>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-[1.05rem] text-white">
            <BrandMark />
          </span>
          <span className="text-[1.05rem] font-semibold tracking-tight">
            eyday<span className="text-primary">·paper</span>
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {view.name === "library" && (
            <Library onOpen={(paperId) => setView({ name: "reader", paperId })} />
          )}
          {view.name === "suggestions" && <Suggestions />}
          {view.name === "settings" && <Settings />}
          {view.name === "reader" && (
            <Reader paperId={view.paperId} onBack={() => setView({ name: "library" })} />
          )}
        </main>
      </div>
    </div>
  );
}
