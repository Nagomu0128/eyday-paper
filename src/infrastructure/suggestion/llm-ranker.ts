import { z } from "zod";
import type {
  ExternalPaper,
  RankedSuggestion,
  SuggestionProfile,
  SuggestionRanker,
} from "../../domain/suggestion/ports";
import { parseLlmJson } from "../ai/json";
import type { LlmClient } from "../ai/llm-client";
import { fence, UNTRUSTED_DATA_NOTE } from "../ai/prompt";

const line = (label: string, values: string[] | undefined): string =>
  values && values.length > 0 ? `${label}: ${values.join(", ")}` : `${label}: (none)`;

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
    profile: SuggestionProfile;
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

    const p = input.profile;
    const profileText = [
      line("Interests", p.interests),
      line("Fields/domains", p.domains),
      line("Organizations of interest", p.organizations),
      line("Avoid", p.avoid),
      `Goal: ${p.goal?.trim() || "(none)"}`,
      `Level: ${p.level ?? "(unknown)"}`,
    ].join("\n");

    const content = await this.llm.complete({
      model: this.model,
      json: true,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'Rank candidate papers for a reader, personalized to their profile. Use ONLY the provided candidates; never invent papers or ids. Favor papers matching the reader\'s interests, fields, organizations, and goal; de-prioritize anything in "Avoid". Return strict JSON {"suggestions":[{"externalId","source","kind":"classic"|"recent","score":0..1,"reason":string}]}. "classic" = seminal/foundational and relevant; "recent" = new and relevant. Reasons are one sentence and should reference why it fits this reader. Up to 12. ' +
            UNTRUSTED_DATA_NOTE,
        },
        {
          role: "user",
          content: `Reader profile:\n${fence(profileText)}\n\nCandidates:\n${JSON.stringify(list)}`,
        },
      ],
    });

    const parsed = schema.safeParse(parseLlmJson(content));
    if (!parsed.success) return [];

    const valid = new Set(input.candidates.map((c) => `${c.source}:${c.externalId}`));
    return parsed.data.suggestions.filter((s) => valid.has(`${s.source}:${s.externalId}`));
  }
}
