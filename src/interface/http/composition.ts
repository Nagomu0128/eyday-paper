import { IngestPaper } from "../../application/ingestion/ingest-paper";
import { ProcessPaper } from "../../application/ingestion/process-paper";
import { ExplainSelection } from "../../application/reading/explain-selection";
import { createDb } from "../../db/client";
import type { ProcessJob } from "../../domain/ingestion/ports";
import type { FolderRepository, PaperRepository, TagRepository } from "../../domain/library/types";
import type { ObjectStorage } from "../../domain/storage/object-storage";
import { AiGatewayLlmClient, buildGatewayBaseUrl } from "../../infrastructure/ai/ai-gateway";
import type { LlmClient } from "../../infrastructure/ai/llm-client";
import { WorkersAiEmbedder } from "../../infrastructure/ai/workers-ai-embedder";
import { LlmFolderAssigner } from "../../infrastructure/ingestion/llm-folder-assigner";
import { LlmTagger } from "../../infrastructure/ingestion/llm-tagger";
import { HttpMetadataResolver } from "../../infrastructure/ingestion/metadata-resolver";
import { CloudflareIngestionQueue } from "../../infrastructure/ingestion/queue";
import { HttpSourceFetcher } from "../../infrastructure/ingestion/source-fetcher";
import { CompositeTextExtractor } from "../../infrastructure/ingestion/text-extractor";
import { LlmExplainer } from "../../infrastructure/reading/llm-explainer";
import {
  DrizzleChunkRepository,
  DrizzleFolderRepository,
  DrizzlePaperRepository,
  DrizzleTagRepository,
} from "../../infrastructure/repositories/library";
import { VectorizeIndexAdapter } from "../../infrastructure/search/vectorize-index";
import { R2ObjectStorage } from "../../infrastructure/storage/r2-object-storage";

const FLASH_LITE = "gemini-2.5-flash-lite";
const GPT_MINI = "gpt-5.4-mini";

const geminiGateway = (env: Env): LlmClient =>
  new AiGatewayLlmClient({
    baseUrl: buildGatewayBaseUrl(
      env.CF_ACCOUNT_ID,
      env.AI_GATEWAY_NAME,
      "google-ai-studio/v1beta/openai",
    ),
    apiKey: env.GEMINI_API_KEY,
  });

const openaiGateway = (env: Env): LlmClient =>
  new AiGatewayLlmClient({
    baseUrl: buildGatewayBaseUrl(env.CF_ACCOUNT_ID, env.AI_GATEWAY_NAME, "openai"),
    apiKey: env.OPENAI_API_KEY,
  });

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
  const gemini = geminiGateway(env);
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

export const buildExplainSelection = (env: Env): ExplainSelection =>
  new ExplainSelection({
    papers: new DrizzlePaperRepository(createDb(env.DB)),
    explainer: new LlmExplainer(openaiGateway(env), GPT_MINI),
  });

export interface LibraryDeps {
  papers: PaperRepository;
  tags: TagRepository;
  folders: FolderRepository;
  storage: ObjectStorage;
}

/** Read-side repositories/storage for the library + reader endpoints. */
export const buildLibrary = (env: Env): LibraryDeps => {
  const db = createDb(env.DB);
  return {
    papers: new DrizzlePaperRepository(db),
    tags: new DrizzleTagRepository(db),
    folders: new DrizzleFolderRepository(db),
    storage: new R2ObjectStorage(env.BUCKET),
  };
};
