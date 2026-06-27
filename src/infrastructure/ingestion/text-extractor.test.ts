import { describe, expect, it } from "vitest";
import { htmlToDoc } from "./text-extractor";

describe("htmlToDoc", () => {
  it("groups paragraphs under headings and strips tags/entities/scripts", () => {
    const html = `<html><body>
      <h1>Intro</h1><p>Hello &amp; <b>world</b>.</p><p>Second.</p>
      <h2>Method</h2><p>We use <i>X</i>.</p>
      <script>ignore()</script></body></html>`;
    const doc = htmlToDoc(html, "en");

    expect(doc.lang).toBe("en");
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]).toEqual({
      heading: "Intro",
      paragraphs: ["Hello & world.", "Second."],
    });
    expect(doc.sections[1]?.heading).toBe("Method");
    expect(doc.sections[1]?.paragraphs[0]).toContain("We use X");
  });

  it("recovers LaTeX from MathML alttext as $…$ (inline) and $$…$$ (display)", () => {
    const html = `<body><p>energy <math alttext="E=mc^2" display="inline"><mi>E</mi></math> is</p>
      <p><math alttext="\\int_0^1 x\\,dx" display="block"><mrow></mrow></math></p>
      <p>entities <math alttext="a &lt; b" display="inline"><mi>a</mi></math> ok</p></body>`;
    const doc = htmlToDoc(html);

    expect(doc.sections[0]?.paragraphs[0]).toContain("$E=mc^2$");
    expect(doc.sections[0]?.paragraphs[1]).toContain("$$\\int_0^1 x\\,dx$$");
    // alttext entities are decoded once (a < b), not left as &lt;.
    expect(doc.sections[0]?.paragraphs[2]).toContain("$a < b$");
  });
});
