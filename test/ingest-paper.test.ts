import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { IngestPaper } from "../src/application/ingestion/ingest-paper";
import { createDb } from "../src/db/client";
import type {
  IngestionQueue,
  MetadataResolver,
  ProcessJob,
  ResolvedMetadata,
  SourceFetcher,
} from "../src/domain/ingestion/ports";
import { r2Keys } from "../src/domain/storage/keys";
import { DrizzlePaperRepository } from "../src/infrastructure/repositories/library";
import { R2ObjectStorage } from "../src/infrastructure/storage/r2-object-storage";
import { seedUser } from "./helpers";

const meta = (over: Partial<ResolvedMetadata> = {}): ResolvedMetadata => ({
  title: "Attention Is All You Need",
  authors: ["Vaswani et al."],
  year: 2017,
  venue: null,
  doi: null,
  arxivId: "1706.03762",
  abstract: "We propose the Transformer.",
  sourceUrl: "https://arxiv.org/abs/1706.03762",
  pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
  lang: "en",
  ...over,
});

class StubResolver implements MetadataResolver {
  constructor(private readonly m: ResolvedMetadata) {}
  resolve(): Promise<ResolvedMetadata> {
    return Promise.resolve(this.m);
  }
}
class StubFetcher implements SourceFetcher {
  constructor(private readonly bytes: ArrayBuffer | null) {}
  fetchPdf(): Promise<ArrayBuffer | null> {
    return Promise.resolve(this.bytes);
  }
}
class RecordingQueue implements IngestionQueue {
  readonly jobs: ProcessJob[] = [];
  enqueueProcess(job: ProcessJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}

describe("IngestPaper", () => {
  it("normalizes, stores the PDF in R2, creates the paper, enqueues processing", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const storage = new R2ObjectStorage(env.BUCKET);
    const queue = new RecordingQueue();
    const userId = await seedUser();
    const pdf = new TextEncoder().encode("%PDF-1.7 fake").buffer as ArrayBuffer;

    const useCase = new IngestPaper({
      papers,
      storage,
      resolver: new StubResolver(meta()),
      fetcher: new StubFetcher(pdf),
      queue,
    });

    const res = await useCase.execute(userId, { kind: "arxiv", value: "1706.03762" });
    expect(res.deduped).toBe(false);

    const paper = await papers.findById(userId, res.paperId);
    expect(paper?.arxivId).toBe("1706.03762");
    expect(paper?.title).toContain("Attention");
    expect(paper?.status).toBe("unread");
    expect(paper?.pdfR2Key).toBe(r2Keys.pdf(userId, res.paperId));
    expect(await storage.getText(r2Keys.pdf(userId, res.paperId))).toContain("%PDF");
    expect(queue.jobs).toEqual([{ userId, paperId: res.paperId }]);
  });

  it("dedupes by arXiv id within the same user (no duplicate, no re-enqueue)", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const storage = new R2ObjectStorage(env.BUCKET);
    const queue = new RecordingQueue();
    const userId = await seedUser();

    const useCase = new IngestPaper({
      papers,
      storage,
      resolver: new StubResolver(meta({ arxivId: "2310.06825" })),
      fetcher: new StubFetcher(null),
      queue,
    });

    const first = await useCase.execute(userId, { kind: "arxiv", value: "2310.06825" });
    const second = await useCase.execute(userId, { kind: "arxiv", value: "2310.06825" });

    expect(second.deduped).toBe(true);
    expect(second.paperId).toBe(first.paperId);
    expect(queue.jobs).toHaveLength(1);
    expect(await papers.list(userId)).toHaveLength(1);
  });
});
