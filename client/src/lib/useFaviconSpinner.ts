import { useEffect } from "react";

/** Static brand favicon (a small two-tone open book), restored when idle. */
const STATIC_FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#faf7f1"/><path d="M4 7A1.5 1.5 0 0 1 5.5 5.5H11a2 2 0 0 1 2 2v11a1.6 1.6 0 0 0-1.2-1.55L5 15.5A1.5 1.5 0 0 1 4 14.1z" fill="#3e4b8b" opacity="0.34"/><path d="M20 7A1.5 1.5 0 0 0 18.5 5.5H13a2 2 0 0 0-2 2v11a1.6 1.6 0 0 1 1.2-1.55L19 15.5A1.5 1.5 0 0 0 20 14.1z" fill="#3e4b8b"/></svg>',
)}`;

function ensureIconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "icon";
  document.head.appendChild(link);
  return link;
}

/**
 * Animates the browser-tab favicon into a spinner while `active`, so a long
 * suggestion refresh stays visible even after switching tabs/windows. Restores
 * the static brand favicon when idle. Throttled to ~11fps to keep it cheap.
 */
export function useFaviconSpinner(active: boolean): void {
  useEffect(() => {
    const link = ensureIconLink();
    if (!active) {
      link.href = STATIC_FAVICON;
      return;
    }

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      link.href = STATIC_FAVICON;
      return;
    }

    let raf = 0;
    let angle = 0;
    let last = 0;
    const cxp = size / 2;
    const cyp = size / 2;
    const radius = 11;

    const render = (t: number) => {
      raf = requestAnimationFrame(render);
      if (t - last < 90) return;
      last = t;
      angle += 0.52;
      ctx.clearRect(0, 0, size, size);
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(62,75,139,0.22)";
      ctx.beginPath();
      ctx.arc(cxp, cyp, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#3e4b8b";
      ctx.beginPath();
      ctx.arc(cxp, cyp, radius, angle, angle + Math.PI * 1.15);
      ctx.stroke();
      link.href = canvas.toDataURL("image/png");
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      link.href = STATIC_FAVICON;
    };
  }, [active]);
}
