import { describe, expect, it } from "vitest";
import type { ExternalPaper } from "../src/domain/suggestion/ports";
import type { LlmClient } from "../src/infrastructure/ai/llm-client";
import { LlmSuggestionRanker } from "../src/infrastructure/suggestion/llm-ranker";

const ext = (id: string, source: ExternalPaper["source"]): ExternalPaper => ({
  externalId: id,
  source,
  title: `t-${id}`,
  authors: [],
  year: 2024,
  url: null,
  arxivId: null,
  doi: null,
  abstract: "a",
});

describe("LlmSuggestionRanker", () => {
  it("keeps only ids present in the candidate set (drops hallucinated ids)", async () => {
    const candidates = [ext("a", "arxiv"), ext("b", "openalex")];
    const reply = JSON.stringify({
      suggestions: [
        { externalId: "a", source: "arxiv", kind: "recent", score: 0.9, reason: "x" },
        { externalId: "ghost", source: "arxiv", kind: "classic", score: 0.8, reason: "invented" },
      ],
    });
    const llm: LlmClient = { complete: () => Promise.resolve(reply) };

    const out = await new LlmSuggestionRanker(llm, "m").rank({
      profile: { interests: [], level: null },
      candidates,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.externalId).toBe("a");
  });

  it("returns [] for no candidates without calling the LLM", async () => {
    let called = false;
    const llm: LlmClient = {
      complete: () => {
        called = true;
        return Promise.resolve("{}");
      },
    };
    const out = await new LlmSuggestionRanker(llm, "m").rank({
      profile: { interests: [], level: null },
      candidates: [],
    });
    expect(out).toEqual([]);
    expect(called).toBe(false);
  });
});
