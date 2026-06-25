import { describe, expect, it } from "vitest";
import { detectIngestInput } from "./input";

describe("detectIngestInput", () => {
  it("detects arXiv ids (new/old style, version, prefix, urls)", () => {
    expect(detectIngestInput("1706.03762")).toEqual({ kind: "arxiv", value: "1706.03762" });
    expect(detectIngestInput("arXiv:1706.03762v5")).toEqual({ kind: "arxiv", value: "1706.03762" });
    expect(detectIngestInput("https://arxiv.org/abs/2310.06825")).toEqual({
      kind: "arxiv",
      value: "2310.06825",
    });
    expect(detectIngestInput("https://arxiv.org/pdf/2310.06825v2.pdf")).toEqual({
      kind: "arxiv",
      value: "2310.06825",
    });
    expect(detectIngestInput("math.GT/0309136")).toEqual({
      kind: "arxiv",
      value: "math.GT/0309136",
    });
  });

  it("detects DOIs (bare + doi.org url)", () => {
    expect(detectIngestInput("10.1145/3292500.3330701")).toEqual({
      kind: "doi",
      value: "10.1145/3292500.3330701",
    });
    expect(detectIngestInput("https://doi.org/10.1038/nature14539")).toEqual({
      kind: "doi",
      value: "10.1038/nature14539",
    });
  });

  it("falls back to url and rejects junk/empty", () => {
    expect(detectIngestInput("https://example.com/p")).toEqual({
      kind: "url",
      value: "https://example.com/p",
    });
    expect(() => detectIngestInput("   ")).toThrow();
    expect(() => detectIngestInput("not a link")).toThrow();
  });
});
