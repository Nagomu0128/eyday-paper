import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SummarizePaper } from "../src/application/summary/summarize-paper";
import { createDb } from "../src/db/client";
import type { ExtractedDoc } from "../src/domain/ingestion/extraction";
import { r2Keys } from "../src/domain/storage/keys";
import type { SummarizeInput, Summarizer, Summary } from "../src/domain/summary/ports";
import type { LlmClient } from "../src/infrastructure/ai/llm-client";
import { DrizzlePaperRepository } from "../src/infrastructure/repositories/library";
import { R2ObjectStorage } from "../src/infrastructure/storage/r2-object-storage";
import { LlmSummarizer } from "../src/infrastructure/summary/llm-summarizer";
import { seedUser } from "./helpers";

class CountingSummarizer implements Summarizer {
  calls = 0;
  summarize(input: SummarizeInput): Promise<Summary> {
    this.calls++;
    return Promise.resolve({
      tldr: `tldr:${input.title}`,
      sections: input.sections.map((s) => ({ heading: s.heading, summary: `sum:${s.heading}` })),
    });
  }
}

const DOC: ExtractedDoc = {
  lang: "en",
  sections: [
    { heading: "Intro", paragraphs: ["a"] },
    { heading: "Method", paragraphs: ["b"] },
  ],
};

describe("SummarizePaper", () => {
  it("generates, caches per lang, and reuses the cache", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const storage = new R2ObjectStorage(env.BUCKET);
    const userId = await seedUser();
    const paper = await papers.create({ id: crypto.randomUUID(), userId, title: "T" });
    const textKey = r2Keys.text(userId, paper.id);
    await storage.put(textKey, JSON.stringify(DOC), "application/json");
    await papers.update(userId, paper.id, { textR2Key: textKey });

    const summarizer = new CountingSummarizer();
    const uc = new SummarizePaper({ papers, storage, summarizer });

    const s1 = await uc.execute({ userId, paperId: paper.id, lang: "ja" });
    expect(s1.tldr).toBe("tldr:T");
    expect(s1.sections).toHaveLength(2);
    expect(summarizer.calls).toBe(1);

    await uc.execute({ userId, paperId: paper.id, lang: "ja" });
    expect(summarizer.calls).toBe(1); // cached

    await uc.execute({ userId, paperId: paper.id, lang: "en" });
    expect(summarizer.calls).toBe(2); // different lang -> recompute
  });

  it("rejects cross-tenant access and not-ready text", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const storage = new R2ObjectStorage(env.BUCKET);
    const u1 = await seedUser();
    const u2 = await seedUser();
    const paper = await papers.create({ id: crypto.randomUUID(), userId: u1, title: "T" });
    const uc = new SummarizePaper({ papers, storage, summarizer: new CountingSummarizer() });

    await expect(uc.execute({ userId: u2, paperId: paper.id, lang: "ja" })).rejects.toThrow();
    await expect(uc.execute({ userId: u1, paperId: paper.id, lang: "ja" })).rejects.toThrow();
  });
});

describe("LlmSummarizer", () => {
  it("maps each section then reduces to a TL;DR", async () => {
    let calls = 0;
    const llm: LlmClient = {
      complete: () => {
        calls++;
        return Promise.resolve(`s${calls}`);
      },
    };
    const res = await new LlmSummarizer(llm, "flash").summarize({
      title: "T",
      sections: [
        { heading: "A", text: "x" },
        { heading: "B", text: "y" },
      ],
      lang: "en",
    });
    expect(res.sections).toHaveLength(2);
    expect(res.tldr).toBeTruthy();
    expect(calls).toBe(3); // 2 section maps + 1 reduce
  });
});
