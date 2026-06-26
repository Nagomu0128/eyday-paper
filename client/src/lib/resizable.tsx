import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useState } from "react";
import { cx } from "./cx";

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * Persisted, draggable panel width. `anchor` is the screen edge the panel sticks
 * to — a left sidebar grows as you drag right; a right pane grows as you drag
 * left. Width survives reloads via localStorage.
 */
export function useResizable(opts: {
  storageKey: string;
  initial: number;
  min: number;
  max: number;
  anchor: "left" | "right";
}) {
  const { storageKey, initial, min, max, anchor } = opts;

  const [width, setWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(storageKey);
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) ? clamp(n, min, max) : initial;
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(Math.round(width)));
  }, [storageKey, width]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const dir = anchor === "right" ? -1 : 1;
      document.body.classList.add("is-resizing");
      const move = (ev: PointerEvent) =>
        setWidth(clamp(startW + dir * (ev.clientX - startX), min, max));
      const up = () => {
        document.body.classList.remove("is-resizing");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [width, anchor, min, max],
  );

  const nudge = useCallback(
    (delta: number) => setWidth((w) => clamp(w + delta, min, max)),
    [min, max],
  );

  return { width, setWidth, onPointerDown, nudge };
}

/** Slim drag affordance with keyboard support; renders a centered grip line. */
export function ResizeHandle({
  anchor,
  label,
  onPointerDown,
  onNudge,
  className,
}: {
  anchor: "left" | "right";
  label: string;
  onPointerDown: (e: ReactPointerEvent) => void;
  onNudge?: (delta: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (!onNudge) return;
        const grow = anchor === "right" ? "ArrowLeft" : "ArrowRight";
        const shrink = anchor === "right" ? "ArrowRight" : "ArrowLeft";
        if (e.key === grow) {
          e.preventDefault();
          onNudge(16);
        } else if (e.key === shrink) {
          e.preventDefault();
          onNudge(-16);
        }
      }}
      className={cx(
        "group relative z-20 flex w-2.5 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none",
        className,
      )}
    >
      <span className="h-9 w-[3px] rounded-full bg-line-strong transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary" />
    </button>
  );
}
