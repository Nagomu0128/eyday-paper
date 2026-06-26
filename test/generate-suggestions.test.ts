import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { GenerateSuggestions } from "../src/application/suggestion/generate-suggestions";
import { createDb } from "../src/db/client";
import type {
  ExternalPaper,
  RankedSuggestion,
  SuggestionRanker,
  SuggestionSource,
} from "../src/domain/suggestion/ports";
import { DrizzlePaperRepository } from "../src/infrastructure/repositories/library";
import { DrizzleProfileRepository } from "../src/infrastructure/repositories/profile";
import { DrizzleSuggestionRepository } from "../src/infrastructure/repositories/suggestion";
import { seedUser } from "./helpers";

const ext = (over: Partial<ExternalPaper>): ExternalPaper => ({
  externalId: "e",
  source: "arxiv",
  title: "t",
  authors: [],
  year: 2024,
  url: null,
  arxivId: null,
  doi: null,
  abstract: null,
  ...over,
});

class StubSource implements SuggestionSource {
  constructor(private readonly papers: ExternalPaper[]) {}
  collect(): Promise<ExternalPaper[]> {
    return Promise.resolve(this.papers);
  }
}
class StubRanker implements SuggestionRanker {
  rank(input: { candidates: ExternalPaper[] }): Promise<RankedSuggestion[]> {
    return Promise.resolve(
      input.candidates.map((c, i) => ({
        externalId: c.externalId,
        source: c.source,
        kind: i % 2 === 0 ? "classic" : "recent",
        score: 1 - i * 0.1,
        reason: `r${i}`,
      })),
    );
  }
}

const deps = () => {
  const db = createDb(env.DB);
  return {
    papers: new DrizzlePaperRepository(db),
    profiles: new DrizzleProfileRepository(db),
    repo: new DrizzleSuggestionRepository(db),
  };
};

describe("GenerateSuggestions", () => {
  it("excludes owned papers, ranks, stores classic/recent, replaces prior batch", async () => {
    const { papers, profiles, repo } = deps();
    const userId = await seedUser();
    await profiles.upsert(userId, { interests: ["nlp"], level: "intermediate" });
    await papers.create({ id: crypto.randomUUID(), userId, title: "Owned", arxivId: "1706.03762" });

    const candidates = [
      ext({ externalId: "1706.03762", source: "arxiv", arxivId: "1706.03762", title: "Owned dup" }),
      ext({ externalId: "2401.0001", source: "arxiv", arxivId: "2401.0001", title: "New A" }),
      ext({ externalId: "W123", source: "openalex", doi: "10.1/x", title: "Classic B" }),
    ];
    const uc = new GenerateSuggestions({
      papers,
      profiles,
      source: new StubSource(candidates),
      ranker: new StubRanker(),
      suggestions: repo,
    });

    const count = await uc.execute(userId);
    expect(count).toBe(2); // owned arXiv excluded

    const all = await repo.list(userId);
    expect(all).toHaveLength(2);
    expect(all.some((s) => s.title === "Owned dup")).toBe(false);
    expect(all.map((s) => s.kind).sort()).toEqual(["classic", "recent"]);

    await uc.execute(userId);
    expect(await repo.list(userId)).toHaveLength(2); // replaced, no growth
  });

  it("does not re-suggest a dismissed paper", async () => {
    const { papers, profiles, repo } = deps();
    const userId = await seedUser();
    const candidates = [ext({ externalId: "2401.0002", source: "arxiv", arxivId: "2401.0002" })];
    const uc = new GenerateSuggestions({
      papers,
      profiles,
      source: new StubSource(candidates),
      ranker: new StubRanker(),
      suggestions: repo,
    });

    await uc.execute(userId);
    const first = (await repo.list(userId))[0];
    expect(first).toBeDefined();
    await repo.dismiss(userId, first?.id ?? "");
    expect(await repo.list(userId)).toHaveLength(0);

    await uc.execute(userId);
    expect(await repo.list(userId)).toHaveLength(0); // stays dismissed
  });

  it("falls back to heuristic ranking when the LLM ranker fails, persisting identifiers", async () => {
    const { papers, profiles, repo } = deps();
    const userId = await seedUser();
    const candidates = [
      ext({
        externalId: "2406.0001",
        source: "arxiv",
        arxivId: "2406.0001",
        year: 2026,
        title: "Recent A",
      }),
      ext({
        externalId: "W9",
        source: "openalex",
        doi: "10.1/old",
        year: 2015,
        title: "Classic B",
      }),
    ];
    const throwingRanker: SuggestionRanker = {
      rank: () => Promise.reject(new Error("LLM gateway 502")),
    };
    const uc = new GenerateSuggestions({
      papers,
      profiles,
      source: new StubSource(candidates),
      ranker: throwingRanker,
      suggestions: repo,
    });

    const count = await uc.execute(userId);
    expect(count).toBe(2); // heuristic fallback still produces suggestions

    const all = await repo.list(userId);
    expect(all.find((s) => s.title === "Recent A")?.arxivId).toBe("2406.0001");
    expect(all.find((s) => s.title === "Classic B")?.doi).toBe("10.1/old");
    // findById is tenant-scoped + returns the persisted identifiers used by import.
    const first = all[0];
    expect(first).toBeDefined();
    if (first) {
      expect((await repo.findById(userId, first.id))?.id).toBe(first.id);
      expect(await repo.findById(await seedUser(), first.id)).toBeNull();
    }
  });
});
