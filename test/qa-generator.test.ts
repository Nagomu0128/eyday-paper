import { describe, expect, it } from "vitest";
import type { LlmClient, LlmCompleteOptions } from "../src/infrastructure/ai/llm-client";
import { LlmAnswerGenerator } from "../src/infrastructure/qa/llm-answer-generator";

describe("LlmAnswerGenerator", () => {
  it("returns an ungrounded not-found without calling the LLM when context is empty", async () => {
    let called = false;
    const llm: LlmClient = {
      complete: () => {
        called = true;
        return Promise.resolve("x");
      },
    };
    const res = await new LlmAnswerGenerator(llm, "gpt").answer({
      question: "q",
      contexts: [],
      lang: "ja",
    });
    expect(called).toBe(false);
    expect(res.grounded).toBe(false);
    expect(res.answer).toContain("見つかりません");
  });

  it("builds a grounded prompt with numbered contexts and trims output", async () => {
    let captured: LlmCompleteOptions | undefined;
    const llm: LlmClient = {
      complete: (opts) => {
        captured = opts;
        return Promise.resolve("  Answer [1].  ");
      },
    };
    const res = await new LlmAnswerGenerator(llm, "gpt").answer({
      question: "what?",
      contexts: [
        { text: "ctxA", section: "Intro", page: 1 },
        { text: "ctxB", section: null, page: null },
      ],
      lang: "en",
    });

    expect(res.answer).toBe("Answer [1].");
    expect(res.grounded).toBe(true);
    expect(captured?.messages[0]?.content).toContain("English");
    expect(captured?.messages[0]?.content).toContain("ONLY");
    expect(captured?.messages[1]?.content).toContain("ctxA");
    expect(captured?.messages[1]?.content).toContain("[1");
  });
});
