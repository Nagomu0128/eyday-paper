import { z } from "zod";
import type {
  ExternalPaper,
  RankedSuggestion,
  SuggestionRanker,
} from "../../domain/suggestion/ports";
import { parseLlmJson } from "../ai/json";
import type { LlmClient } from "../ai/llm-client";

const schema = z.object({
  suggestions: z
    .array(
      z.object({
        externalId: z.string(),
        source: z.enum(["s2", "arxiv", "openalex"]),
        kind: z.enum(["classic", "recent"]),
        score: z.number(),
        reason: z.string(),
      }),
    )
    .max(20),
});

/** Ranks real candidates with the LLM; drops any id the LLM didn't get from the data. */
export class LlmSuggestionRanker implements SuggestionRanker {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async rank(input: {
    profile: { interests: string[]; level: string | null };
    candidates: ExternalPaper[];
  }): Promise<RankedSuggestion[]> {
    if (input.candidates.length === 0) return [];

    const list = input.candidates.map((c) => ({
      externalId: c.externalId,
      source: c.source,
      year: c.year,
      title: c.title,
      abstract: (c.abstract ?? "").slice(0, 300),
    }));

    const content = await this.llm.complete({
      model: this.model,
      json: true,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'Rank candidate papers for a reader. Use ONLY the provided candidates; never invent papers or ids. Return strict JSON {"suggestions":[{"externalId","source","kind":"classic"|"recent","score":0..1,"reason":string}]}. "classic" = seminal/foundational and relevant; "recent" = new and relevant. One-sentence reasons. Up to 12.',
        },
        {
          role: "user",
          content: `Interests: ${input.profile.interests.join(", ") || "(none)"}\nLevel: ${input.profile.level ?? "(unknown)"}\nCandidates:\n${JSON.stringify(list)}`,
        },
      ],
    });

    const parsed = schema.safeParse(parseLlmJson(content));
    if (!parsed.success) return [];

    const valid = new Set(input.candidates.map((c) => `${c.source}:${c.externalId}`));
    return parsed.data.suggestions.filter((s) => valid.has(`${s.source}:${s.externalId}`));
  }
}
