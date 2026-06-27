import type { Explainer, ExplainInput, Explanation } from "../../domain/reading/ports";
import type { LlmClient } from "../ai/llm-client";
import { fence, UNTRUSTED_DATA_NOTE } from "../ai/prompt";

const langName = (lang: ExplainInput["lang"]): string => (lang === "ja" ? "Japanese" : "English");

/** Explainer backed by a GPT-mini through AI Gateway. Grounds on provided text only. */
export class LlmExplainer implements Explainer {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async explain(input: ExplainInput): Promise<Explanation> {
    const content = await this.llm.complete({
      model: this.model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You explain passages from academic papers clearly and concisely in ${langName(input.lang)}. Use only the provided selection and context; do not invent facts. If the selection is a formula or table, explain what it represents and defines. ${UNTRUSTED_DATA_NOTE}`,
        },
        {
          role: "user",
          content: `Paper: ${input.title}\nSection: ${input.section ?? "(unknown)"}\nContext:\n${fence(input.context ?? "(none)")}\n\nExplain this selection:\n${fence(input.selectedText)}`,
        },
      ],
    });

    return {
      explanation: content.trim(),
      source: { section: input.section, page: input.page },
    };
  }
}
