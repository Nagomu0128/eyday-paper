import type { OutputLang } from "../../domain/identity/profile";
import type { AnswerContext, AnswerGenerator, GroundedAnswer } from "../../domain/qa/ports";
import type { LlmClient } from "../ai/llm-client";

const notFound = (lang: OutputLang): string =>
  lang === "ja"
    ? "提供された論文の文脈からは、その質問の答えが見つかりませんでした。"
    : "I couldn't find an answer to that in the retrieved context.";

/** Grounded answer generator (GPT-mid via AI Gateway). Answers only from context. */
export class LlmAnswerGenerator implements AnswerGenerator {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async answer(input: {
    question: string;
    contexts: AnswerContext[];
    lang: OutputLang;
  }): Promise<GroundedAnswer> {
    if (input.contexts.length === 0) {
      return { answer: notFound(input.lang), grounded: false };
    }

    const langName = input.lang === "ja" ? "Japanese" : "English";
    const ctx = input.contexts
      .map((c, i) => `[${i + 1}${c.section ? ` · ${c.section}` : ""}]\n${c.text}`)
      .join("\n\n");

    const content = await this.llm.complete({
      model: this.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `Answer the question using ONLY the provided context passages, in ${langName}. Cite the passages you rely on like [1], [2]. If the answer is not contained in the context, clearly say you could not find it. Never invent facts or sources.`,
        },
        { role: "user", content: `Question: ${input.question}\n\nContext:\n${ctx}` },
      ],
    });

    return { answer: content.trim(), grounded: true };
  }
}
