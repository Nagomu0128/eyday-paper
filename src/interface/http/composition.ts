import { IngestPaper } from "../../application/ingestion/ingest-paper";
import { createDb } from "../../db/client";
import type { ProcessJob } from "../../domain/ingestion/ports";
import { HttpMetadataResolver } from "../../infrastructure/ingestion/metadata-resolver";
import { CloudflareIngestionQueue } from "../../infrastructure/ingestion/queue";
import { HttpSourceFetcher } from "../../infrastructure/ingestion/source-fetcher";
import { DrizzlePaperRepository } from "../../infrastructure/repositories/library";
import { R2ObjectStorage } from "../../infrastructure/storage/r2-object-storage";

/** Composition root: build use cases from the request's bindings. */
export const buildIngestPaper = (env: Env): IngestPaper =>
  new IngestPaper({
    papers: new DrizzlePaperRepository(createDb(env.DB)),
    storage: new R2ObjectStorage(env.BUCKET),
    resolver: new HttpMetadataResolver(),
    fetcher: new HttpSourceFetcher(),
    queue: new CloudflareIngestionQueue(env.INGEST_QUEUE as Queue<ProcessJob>),
  });
