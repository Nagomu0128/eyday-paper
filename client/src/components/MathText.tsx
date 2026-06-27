import katex from "katex";
import { memo, useMemo } from "react";

/**
 * Renders a paper paragraph as plain prose with embedded LaTeX rendered by KaTeX.
 * Unlike <Markdown>, this does NOT interpret Markdown — scientific prose is full
 * of `*`, `_`, `#` that must stay literal. It only splits on math delimiters
 * ($$…$$ / $…$ / \[…\] / \(…\)); paragraphs without math render unchanged.
 * Display math ($$…$$ / \[…\]) breaks to its own centered line (KaTeX's CSS).
 */

// Order matters: match $$…$$ and \[…\] (display) before the single-char forms.
const SEGMENT = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

interface Seg {
  /** Start offset in the source text — a stable, unique React key. */
  at: number;
  math: boolean;
  display: boolean;
  value: string;
}

const split = (text: string): Seg[] => {
  const out: Seg[] = [];
  let last = 0;
  SEGMENT.lastIndex = 0;
  let m = SEGMENT.exec(text);
  while (m !== null) {
    if (m.index > last)
      out.push({ at: last, math: false, display: false, value: text.slice(last, m.index) });
    const raw = m[0];
    const display = raw.startsWith("$$") || raw.startsWith("\\[");
    const tex = display ? raw.slice(2, -2) : raw.slice(raw.startsWith("\\(") ? 2 : 1, -1);
    out.push({ at: m.index, math: true, display, value: tex.trim() });
    last = SEGMENT.lastIndex;
    m = SEGMENT.exec(text);
  }
  if (last < text.length)
    out.push({ at: last, math: false, display: false, value: text.slice(last) });
  return out;
};

export const MathText = memo(function MathText({ text }: { text: string }) {
  const segs = useMemo(() => split(text), [text]);
  return (
    <p>
      {segs.map((s) => {
        if (!s.math) return <span key={s.at}>{s.value}</span>;
        let html: string | null = null;
        try {
          html = katex.renderToString(s.value, { displayMode: s.display, throwOnError: false });
        } catch {
          html = null;
        }
        if (html === null) {
          return <span key={s.at}>{s.display ? `$$${s.value}$$` : `$${s.value}$`}</span>;
        }
        return (
          <span
            key={s.at}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX returns sanitized markup
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </p>
  );
});
