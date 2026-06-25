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
});
