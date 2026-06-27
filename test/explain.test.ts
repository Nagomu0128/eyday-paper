import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ExplainSelection } from "../src/application/reading/explain-selection";
import { createDb } from "../src/db/client";
import type { Explainer, ExplainInput, Explanation } from "../src/domain/reading/ports";
import type { LlmClient, LlmCompleteOptions } from "../src/infrastructure/ai/llm-client";
import { LlmExplainer } from "../src/infrastructure/reading/llm-explainer";
import { DrizzlePaperRepository } from "../src/infrastructure/repositories/library";
import { allowAllLimiter, seedUser } from "./helpers";

class StubExplainer implements Explainer {
  lastInput?: ExplainInput;
  explain(input: ExplainInput): Promise<Explanation> {
    this.lastInput = input;
    return Promise.resolve({
      explanation: `explained: ${input.selectedText}`,
      source: { section: input.section, page: input.page },
    });
  }
}

describe("ExplainSelection", () => {
  it("verifies ownership, rejects empty selection, returns a source span", async () => {
    const papers = new DrizzlePaperRepository(createDb(env.DB));
    const u1 = await seedUser();
    const u2 = await seedUser();
    const paper = await papers.create({
      id: crypto.randomUUID(),
      userId: u1,
      title: "T",
      abstract: null,
    });
    const explainer = new StubExplainer();
    const uc = new ExplainSelection({ papers, explainer, limiter: allowAllLimiter });

    const res = await uc.execute({
      userId: u1,
      paperId: paper.id,
      selectedText: "softmax",
      context: "ctx",
      section: "Method",
      page: 3,
      lang: "ja",
    });
    expect(res.explanation).toContain("softmax");
    expect(res.source).toEqual({ section: "Method", page: 3 });
    expect(explainer.lastInput?.title).toBe("T");

    await expect(
      uc.execute({
        userId: u2,
        paperId: paper.id,
        selectedText: "x",
        context: null,
        section: null,
        page: null,
        lang: "en",
      }),
    ).rejects.toThrow();

    await expect(
      uc.execute({
        userId: u1,
        paperId: paper.id,
        selectedText: "   ",
        context: null,
        section: null,
        page: null,
        lang: "en",
      }),
    ).rejects.toThrow();
  });
});

describe("LlmExplainer", () => {
  it("builds a grounded prompt and trims the model output", async () => {
    let captured: LlmCompleteOptions | undefined;
    const llm: LlmClient = {
      complete: (opts) => {
        captured = opts;
        return Promise.resolve("  Scaled dot-product attention.  ");
      },
    };
    const res = await new LlmExplainer(llm, "gpt-mini").explain({
      title: "Attention",
      selectedText: "softmax(QK^T/sqrt(d))",
      context: "scaled dot product",
      section: "3.2",
      page: 4,
      lang: "en",
    });

    expect(res.explanation).toBe("Scaled dot-product attention.");
    expect(res.source).toEqual({ section: "3.2", page: 4 });
    expect(captured?.model).toBe("gpt-mini");
    expect(captured?.messages[0]?.content).toContain("English");
    expect(captured?.messages.some((m) => m.content.includes("softmax(QK^T/sqrt(d))"))).toBe(true);
  });
});
