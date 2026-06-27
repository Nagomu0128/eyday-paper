import { z } from "zod";
import type { FolderAssigner } from "../../domain/ingestion/extraction";
import { parseLlmJson } from "../ai/json";
import type { LlmClient } from "../ai/llm-client";
import { fence, UNTRUSTED_DATA_NOTE } from "../ai/prompt";

const folderSchema = z.object({ folder: z.string().min(1).max(60) });

/** Cheap-model home-folder assignment, biased toward reusing existing folders. */
export class LlmFolderAssigner implements FolderAssigner {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async assign(input: {
    existingFolders: string[];
    title: string;
    abstract: string | null;
    tags: string[];
  }): Promise<{ name: string }> {
    const content = await this.llm.complete({
      model: this.model,
      json: true,
      messages: [
        {
          role: "system",
          content:
            'Assign the paper to ONE home folder. Prefer an existing folder if it fits; otherwise propose a concise new topical folder. Reply with strict JSON {"folder":string}. ' +
            UNTRUSTED_DATA_NOTE,
        },
        {
          role: "user",
          content: `Existing folders: ${input.existingFolders.join(", ") || "(none)"}\nTitle: ${input.title}\nTags: ${input.tags.join(", ")}\n${fence(`Abstract: ${input.abstract ?? ""}`)}`,
        },
      ],
    });

    const parsed = folderSchema.safeParse(parseLlmJson(content));
    const name = parsed.success
      ? parsed.data.folder.trim()
      : (input.existingFolders[0] ?? "Unsorted");
    return { name };
  }
}
