import { describe, expect, it } from "vitest";
import type { LlmClient } from "../ai/llm-client";
import { LlmTagger } from "./llm-tagger";

class StubLlm implements LlmClient {
  constructor(private readonly reply: string) {}
  complete(): Promise<string> {
    return Promise.resolve(this.reply);
  }
}

describe("LlmTagger", () => {
  it("parses JSON tags and dedupes case-insensitively", async () => {
    const llm = new StubLlm(
      '{"tags":[{"name":"NLP","kind":"field"},{"name":"nlp","kind":"field"},{"name":"transformers","kind":"method"}]}',
    );
    const tags = await new LlmTagger(llm, "m").suggest({ title: "t", abstract: null, sample: "" });
    expect(tags).toEqual([
      { name: "NLP", kind: "field" },
      { name: "transformers", kind: "method" },
    ]);
  });

  it("tolerates a ```json fenced reply", async () => {
    const llm = new StubLlm('```json\n{"tags":[{"name":"rl","kind":"topic"}]}\n```');
    const tags = await new LlmTagger(llm, "m").suggest({ title: "t", abstract: null, sample: "" });
    expect(tags).toEqual([{ name: "rl", kind: "topic" }]);
  });

  it("returns [] on unparseable output", async () => {
    const tags = await new LlmTagger(new StubLlm("sorry, no"), "m").suggest({
      title: "t",
      abstract: null,
      sample: "",
    });
    expect(tags).toEqual([]);
  });
});
