import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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

type Auth = "loading" | "in" | "out";

const navIdForPath = (pathname: string): NavId =>
  pathname.startsWith("/suggestions")
    ? "suggestions"
    : pathname.startsWith("/settings")
      ? "settings"
      : "library";

const pathForNav = (id: NavId): string => (id === "library" ? "/" : `/${id}`);

/** Reader route: paperId comes from the URL so reload/deep-link works. */
function ReaderRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  // Prefer in-app back; fall back to the library when there's no history (deep link).
  const onBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return <Reader paperId={id} onBack={onBack} />;
}

export default function App() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const navigate = useNavigate();
  const location = useLocation();
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

  const go = (id: NavId) => navigate(pathForNav(id));

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <Sidebar
        active={navIdForPath(location.pathname)}
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
          <Routes>
            <Route
              path="/"
              element={<Library onOpen={(paperId) => navigate(`/paper/${paperId}`)} />}
            />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/paper/:id" element={<ReaderRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
