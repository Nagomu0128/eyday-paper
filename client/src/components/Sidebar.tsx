import type { ComponentType, SVGProps } from "react";
import { api } from "../lib/api";
import { cx } from "../lib/cx";
import {
  BrandMark,
  IconLibrary,
  IconPanelLeft,
  IconSettings,
  IconSignOut,
  IconSparkles,
  IconSpinner,
} from "../lib/icons";
import { ResizeHandle, useResizable } from "../lib/resizable";
import { useSuggestionsStatus } from "../lib/suggestionsStore";
import { useMediaQuery } from "../lib/useMediaQuery";
import type { Me } from "../types";
import { Avatar, IconButton } from "./ui";

export type NavId = "library" | "suggestions" | "settings";

type NavItem = {
  id: NavId;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const NAV: NavItem[] = [
  { id: "library", label: "Library", icon: IconLibrary },
  { id: "suggestions", label: "Suggestions", icon: IconSparkles },
  { id: "settings", label: "Settings", icon: IconSettings },
];

export function Sidebar({
  active,
  onNavigate,
  me,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  me: Me | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { width, onPointerDown, nudge } = useResizable({
    storageKey: "eyday.sidebar.w",
    initial: 264,
    min: 212,
    max: 360,
    anchor: "left",
  });
  const { refreshing } = useSuggestionsStatus();

  const rail = isDesktop && collapsed;
  const desktopWidth = rail ? 76 : width;

  const navigate = (id: NavId) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        style={isDesktop ? { width: desktopWidth } : undefined}
        className={cx(
          "relative z-40 flex h-dvh shrink-0 flex-col border-r border-line bg-canvas",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[82%] max-lg:max-w-xs max-lg:shadow-pop max-lg:transition-transform",
          !isDesktop && (mobileOpen ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        {/* Brand */}
        <div className={cx("flex h-16 items-center gap-2.5 px-3", rail && "justify-center px-2")}>
          {rail ? (
            // Collapsed: the app icon itself reopens the sidebar (no separate button).
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="サイドバーを開く (⌘/Ctrl+B)"
              aria-label="サイドバーを開く"
              className="group grid h-10 w-10 place-items-center rounded-xl bg-primary text-[1.4rem] text-white shadow-card transition hover:bg-primary-hover"
            >
              <span className="transition-transform group-hover:scale-110">
                <BrandMark />
              </span>
            </button>
          ) : (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-[1.35rem] text-white shadow-card">
                <BrandMark />
              </span>
              <button
                type="button"
                onClick={() => navigate("library")}
                className="min-w-0 flex-1 text-left text-[1.0625rem] font-semibold tracking-tight text-ink"
              >
                eyday<span className="text-primary">·paper</span>
              </button>
              <IconButton
                label="サイドバーを畳む (⌘/Ctrl+B)"
                size="sm"
                onClick={() => (isDesktop ? onToggleCollapsed() : onCloseMobile())}
                className="max-lg:hidden"
              >
                <IconPanelLeft />
              </IconButton>
            </>
          )}
        </div>

        {/* Nav */}
        <nav
          className={cx("flex flex-1 flex-col gap-1 overflow-y-auto p-2", rail && "items-center")}
        >
          {!rail && (
            <p className="px-3 pb-1 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Menu
            </p>
          )}
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            const busy = item.id === "suggestions" && refreshing;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                title={rail ? item.label : undefined}
                className={cx(
                  "group relative flex items-center rounded-xl text-[0.95rem] font-medium transition-colors",
                  rail ? "h-11 w-11 justify-center" : "h-11 gap-3 px-3",
                  isActive
                    ? "bg-primary-soft text-primary-ink"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span className="grid place-items-center text-[1.3rem]">
                  {busy ? <IconSpinner className="text-primary" /> : <Icon />}
                </span>
                {!rail && <span className="flex-1 text-left">{item.label}</span>}
                {!rail && busy && (
                  <span className="text-[0.7rem] font-medium text-primary">更新中</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-line p-2">
          <div
            className={cx(
              "flex items-center rounded-xl p-1.5",
              rail ? "flex-col gap-2" : "gap-2.5",
            )}
          >
            <Avatar src={me?.image} name={me?.name ?? me?.email} size={rail ? 34 : 36} />
            {!rail && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.85rem] font-semibold text-ink">
                  {me?.name ?? "ゲスト"}
                </p>
                <p className="truncate text-[0.72rem] text-ink-muted">{me?.email ?? ""}</p>
              </div>
            )}
            <IconButton
              label="サインアウト"
              size="sm"
              variant="ghost"
              onClick={() => api.signOut()}
            >
              <IconSignOut />
            </IconButton>
          </div>
        </div>

        {/* Resize handle (desktop, expanded only) */}
        {isDesktop && !collapsed && (
          <div className="absolute inset-y-0 right-0 translate-x-1/2">
            <ResizeHandle
              anchor="left"
              label="サイドバーの幅を変更"
              onPointerDown={onPointerDown}
              onNudge={nudge}
              className="h-full"
            />
          </div>
        )}
      </aside>
    </>
  );
}
