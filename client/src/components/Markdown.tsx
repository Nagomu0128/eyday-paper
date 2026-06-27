import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Renders LLM output (Q&A answers, summaries, explanations) as Markdown with
 * GitHub flavor + LaTeX math ($…$ / $$…$$ via KaTeX). Styling lives in the `.md`
 * scope in index.css. Links open in a new tab. The model's text is trusted as
 * content only — never as HTML — so no `rehype-raw`/raw HTML is enabled.
 */
const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
