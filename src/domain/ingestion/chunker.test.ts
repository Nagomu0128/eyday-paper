import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunker";
import type { ExtractedDoc } from "./extraction";

describe("chunkDocument", () => {
  it("starts a fresh chunk per section and labels with the heading", () => {
    const doc: ExtractedDoc = {
      lang: "en",
      sections: [
        { heading: "Introduction", paragraphs: ["a", "b"] },
        { heading: "Method", paragraphs: ["c"] },
      ],
    };
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.idx)).toEqual([0, 1]);
    expect(chunks[0]?.section).toBe("Introduction");
    expect(chunks[0]?.text).toContain("Introduction");
    expect(chunks[1]?.section).toBe("Method");
  });

  it("merges small paragraphs and splits when exceeding maxChars", () => {
    const doc: ExtractedDoc = {
      lang: null,
      sections: [{ heading: null, paragraphs: ["aaaa", "bbbb", "cccc"] }],
    };
    // maxChars=8: "aaaa"(4) + "bbbb"(8) ok; "cccc" would push to 12 -> new chunk.
    const chunks = chunkDocument(doc, 8);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text).toContain("aaaa");
    expect(chunks[0]?.text).toContain("bbbb");
    expect(chunks[1]?.text).toContain("cccc");
  });

  it("keeps an oversized paragraph intact in its own chunk", () => {
    const big = "x".repeat(50);
    const doc: ExtractedDoc = { lang: null, sections: [{ heading: null, paragraphs: [big] }] };
    const chunks = chunkDocument(doc, 10);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain(big);
  });

  it("skips empty paragraphs and empty sections", () => {
    const doc: ExtractedDoc = {
      lang: null,
      sections: [
        { heading: "Empty", paragraphs: ["  ", ""] },
        { heading: "Real", paragraphs: ["content"] },
      ],
    };
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.section).toBe("Real");
  });
});
