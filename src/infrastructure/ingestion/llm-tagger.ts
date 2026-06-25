import { z } from "zod";
import type { Tagger, TagSuggestion } from "../../domain/ingestion/extraction";
import { parseLlmJson } from "../ai/json";
import type { LlmClient } from "../ai/llm-client";

const tagsSchema = z.object({
  tags: z
    .array(
      z.object({ name: z.string().min(1).max(40), kind: z.enum(["field", "topic", "method"]) }),
    )
    .max(8),
});

/** Cheap-model tagger (Gemini Flash-Lite) producing field/topic/method tags. */
export class LlmTagger implements Tagger {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async suggest(input: {
    title: string;
    abstract: string | null;
    sample: string;
  }): Promise<TagSuggestion[]> {
    const content = await this.llm.complete({
      model: this.model,
      json: true,
      messages: [
        {
          role: "system",
          content:
            'Tag academic papers. Reply with strict JSON {"tags":[{"name":string,"kind":"field"|"topic"|"method"}]}. 3-6 concise lowercase tags. No prose.',
        },
        {
          role: "user",
          content: `Title: ${input.title}\nAbstract: ${input.abstract ?? ""}\nExcerpt: ${input.sample}`,
        },
      ],
    });

    const parsed = tagsSchema.safeParse(parseLlmJson(content));
    if (!parsed.success) return [];

    const seen = new Set<string>();
    const out: TagSuggestion[] = [];
    for (const t of parsed.data.tags) {
      const key = `${t.kind}:${t.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: t.name, kind: t.kind });
    }
    return out;
  }
}
