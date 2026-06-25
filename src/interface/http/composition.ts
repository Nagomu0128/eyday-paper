import { IngestPaper } from "../../application/ingestion/ingest-paper";
import { ProcessPaper } from "../../application/ingestion/process-paper";
import { createDb } from "../../db/client";
import type { ProcessJob } from "../../domain/ingestion/ports";
import { AiGatewayLlmClient, buildGatewayBaseUrl } from "../../infrastructure/ai/ai-gateway";
import { WorkersAiEmbedder } from "../../infrastructure/ai/workers-ai-embedder";
import { LlmFolderAssigner } from "../../infrastructure/ingestion/llm-folder-assigner";
import { LlmTagger } from "../../infrastructure/ingestion/llm-tagger";
import { HttpMetadataResolver } from "../../infrastructure/ingestion/metadata-resolver";
import { CloudflareIngestionQueue } from "../../infrastructure/ingestion/queue";
import { HttpSourceFetcher } from "../../infrastructure/ingestion/source-fetcher";
import { CompositeTextExtractor } from "../../infrastructure/ingestion/text-extractor";
import {
  DrizzleChunkRepository,
  DrizzleFolderRepository,
  DrizzlePaperRepository,
  DrizzleTagRepository,
} from "../../infrastructure/repositories/library";
import { VectorizeIndexAdapter } from "../../infrastructure/search/vectorize-index";
import { R2ObjectStorage } from "../../infrastructure/storage/r2-object-storage";

const FLASH_LITE = "gemini-2.5-flash-lite";

/** Composition root: build use cases from the request's bindings. */
export const buildIngestPaper = (env: Env): IngestPaper =>
  new IngestPaper({
    papers: new DrizzlePaperRepository(createDb(env.DB)),
    storage: new R2ObjectStorage(env.BUCKET),
    resolver: new HttpMetadataResolver(),
    fetcher: new HttpSourceFetcher(),
    queue: new CloudflareIngestionQueue(env.INGEST_QUEUE as Queue<ProcessJob>),
  });

export const buildProcessPaper = (env: Env): ProcessPaper => {
  const db = createDb(env.DB);
  const gemini = new AiGatewayLlmClient({
    baseUrl: buildGatewayBaseUrl(
      env.CF_ACCOUNT_ID,
      env.AI_GATEWAY_NAME,
      "google-ai-studio/v1beta/openai",
    ),
    apiKey: env.GEMINI_API_KEY,
  });
  return new ProcessPaper({
    papers: new DrizzlePaperRepository(db),
    folders: new DrizzleFolderRepository(db),
    tags: new DrizzleTagRepository(db),
    chunks: new DrizzleChunkRepository(db),
    storage: new R2ObjectStorage(env.BUCKET),
    extractor: new CompositeTextExtractor(),
    tagger: new LlmTagger(gemini, FLASH_LITE),
    folderAssigner: new LlmFolderAssigner(gemini, FLASH_LITE),
    embedder: new WorkersAiEmbedder(env.AI),
    vectorIndex: new VectorizeIndexAdapter(env.VECTORIZE),
  });
};
