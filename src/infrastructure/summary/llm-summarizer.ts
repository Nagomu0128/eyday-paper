import type {
  SummarizeInput,
  Summarizer,
  Summary,
  SummarySection,
} from "../../domain/summary/ports";
import type { LlmClient } from "../ai/llm-client";
import { fence, UNTRUSTED_DATA_NOTE } from "../ai/prompt";

const MAX_SECTIONS = 12;
const langName = (lang: SummarizeInput["lang"]): string => (lang === "ja" ? "Japanese" : "English");

/**
 * Map-reduce summarizer (Gemini Flash via AI Gateway): summarize each section in
 * parallel (map), then reduce the section summaries into a TL;DR. Output language
 * is the requested one; the source text is never translated wholesale.
 */
export class LlmSummarizer implements Summarizer {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async summarize(input: SummarizeInput): Promise<Summary> {
    const lang = langName(input.lang);
    const capped = input.sections.slice(0, MAX_SECTIONS);

    const sections: SummarySection[] = await Promise.all(
      capped.map(async (s) => ({
        heading: s.heading,
        summary: (
          await this.llm.complete({
            model: this.model,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `Summarize this section of an academic paper in 1-2 sentences in ${lang}. Be faithful; do not invent. ${UNTRUSTED_DATA_NOTE}`,
              },
              { role: "user", content: fence(`${s.heading ? `${s.heading}\n` : ""}${s.text}`) },
            ],
          })
        ).trim(),
      })),
    );

    const tldr = (
      await this.llm.complete({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Write a 2-3 sentence TL;DR of the paper in ${lang}, based on the section summaries. Faithful, no new facts. ${UNTRUSTED_DATA_NOTE}`,
          },
          {
            role: "user",
            content: `Title: ${input.title}\n\n${fence(sections.map((s) => `${s.heading ?? ""}: ${s.summary}`).join("\n"))}`,
          },
        ],
      })
    ).trim();

    return { tldr, sections };
  }
}
