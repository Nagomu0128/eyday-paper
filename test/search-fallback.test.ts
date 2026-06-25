import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db/client";
import {
  DrizzleChunkRepository,
  DrizzlePaperRepository,
} from "../src/infrastructure/repositories/library";
import {
  cosineSimilarity,
  D1BruteForceIndex,
} from "../src/infrastructure/search/d1-brute-force-index";
import { seedUser } from "./helpers";

describe("cosineSimilarity", () => {
  it("identical = 1, orthogonal = 0, zero vector = 0", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });
});

describe("D1BruteForceIndex (swappable search fallback)", () => {
  it("ranks by cosine, isolates tenants, and deletes by id", async () => {
    const db = createDb(env.DB);
    const index = new D1BruteForceIndex(db);
    const papers = new DrizzlePaperRepository(db);
    const chunks = new DrizzleChunkRepository(db);

    const u1 = await seedUser();
    const u2 = await seedUser();
    const p1 = await papers.create({ id: crypto.randomUUID(), userId: u1, title: "P1" });
    const p2 = await papers.create({ id: crypto.randomUUID(), userId: u2, title: "P2" });

    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    const c3 = crypto.randomUUID();
    await chunks.bulkCreate([
      { id: c1, userId: u1, paperId: p1.id, idx: 0 },
      { id: c2, userId: u1, paperId: p1.id, idx: 1 },
    ]);
    await chunks.bulkCreate([{ id: c3, userId: u2, paperId: p2.id, idx: 0 }]);

    await index.upsert([
      { id: c1, values: [1, 0, 0], userId: u1, paperId: p1.id, chunkIdx: 0, section: "intro" },
      { id: c2, values: [0, 1, 0], userId: u1, paperId: p1.id, chunkIdx: 1, section: "method" },
      { id: c3, values: [1, 0, 0], userId: u2, paperId: p2.id, chunkIdx: 0, section: "intro" },
    ]);

    const res = await index.query({ embedding: [0.9, 0.1, 0], userId: u1, topK: 5 });
    expect(res[0]?.id).toBe(c1); // closest to [1,0,0]
    expect(res.every((m) => m.userId === u1)).toBe(true); // u2's vector never returned
    expect(res.find((m) => m.id === c3)).toBeUndefined();

    await index.deleteVectors([c1]);
    const after = await index.query({ embedding: [1, 0, 0], userId: u1, topK: 5 });
    expect(after.find((m) => m.id === c1)).toBeUndefined();
  });
});
