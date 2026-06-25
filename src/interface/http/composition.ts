import { IngestPaper } from "../../application/ingestion/ingest-paper";
import { ProcessPaper } from "../../application/ingestion/process-paper";
import { AnswerQuestion } from "../../application/qa/answer-question";
import { ExplainSelection } from "../../application/reading/explain-selection";
import { GenerateSuggestions } from "../../application/suggestion/generate-suggestions";
import { SummarizePaper } from "../../application/summary/summarize-paper";
import { createDb } from "../../db/client";
import type { ProcessJob } from "../../domain/ingestion/ports";
import type { FolderRepository, PaperRepository, TagRepository } from "../../domain/library/types";
import type { ObjectStorage } from "../../domain/storage/object-storage";
import { AiGatewayLlmClient, buildGatewayBaseUrl } from "../../infrastructure/ai/ai-gateway";
import type { LlmClient } from "../../infrastructure/ai/llm-client";
import { WorkersAiEmbedder } from "../../infrastructure/ai/workers-ai-embedder";
import { WorkersAiReranker } from "../../infrastructure/ai/workers-ai-reranker";
import { LlmFolderAssigner } from "../../infrastructure/ingestion/llm-folder-assigner";
import { LlmTagger } from "../../infrastructure/ingestion/llm-tagger";
import { HttpMetadataResolver } from "../../infrastructure/ingestion/metadata-resolver";
import { CloudflareIngestionQueue } from "../../infrastructure/ingestion/queue";
import { HttpSourceFetcher } from "../../infrastructure/ingestion/source-fetcher";
import { CompositeTextExtractor } from "../../infrastructure/ingestion/text-extractor";
import { LlmAnswerGenerator } from "../../infrastructure/qa/llm-answer-generator";
import { LlmExplainer } from "../../infrastructure/reading/llm-explainer";
import {
  DrizzleChunkRepository,
  DrizzleFolderRepository,
  DrizzleNoteRepository,
  DrizzlePaperRepository,
  DrizzleTagRepository,
} from "../../infrastructure/repositories/library";
import { DrizzleProfileRepository } from "../../infrastructure/repositories/profile";
import { DrizzleQaMessageRepository } from "../../infrastructure/repositories/qa";
import { DrizzleSuggestionRepository } from "../../infrastructure/repositories/suggestion";
import { VectorizeIndexAdapter } from "../../infrastructure/search/vectorize-index";
import { R2ObjectStorage } from "../../infrastructure/storage/r2-object-storage";
import { LlmSuggestionRanker } from "../../infrastructure/suggestion/llm-ranker";
import {
  ArxivRecentSource,
  CompositeSuggestionSource,
  OpenAlexSource,
  S2RecommendationsSource,
} from "../../infrastructure/suggestion/sources";
import { LlmSummarizer } from "../../infrastructure/summary/llm-summarizer";

const FLASH_LITE = "gemini-2.5-flash-lite";
const FLASH = "gemini-2.5-flash";
const GPT_MINI = "gpt-5.4-mini";
const GPT_MID = "gpt-5.4";

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

export const buildAnswerQuestion = (env: Env): AnswerQuestion => {
  const db = createDb(env.DB);
  return new AnswerQuestion({
    papers: new DrizzlePaperRepository(db),
    chunks: new DrizzleChunkRepository(db),
    embedder: new WorkersAiEmbedder(env.AI),
    vectorIndex: new VectorizeIndexAdapter(env.VECTORIZE),
    reranker: new WorkersAiReranker(env.AI),
    generator: new LlmAnswerGenerator(openaiGateway(env), GPT_MID),
    history: new DrizzleQaMessageRepository(db),
  });
};

export const buildQaHistory = (env: Env): DrizzleQaMessageRepository =>
  new DrizzleQaMessageRepository(createDb(env.DB));

export const buildSummarizePaper = (env: Env): SummarizePaper =>
  new SummarizePaper({
    papers: new DrizzlePaperRepository(createDb(env.DB)),
    storage: new R2ObjectStorage(env.BUCKET),
    summarizer: new LlmSummarizer(geminiGateway(env), FLASH),
  });

export const buildGenerateSuggestions = (env: Env): GenerateSuggestions => {
  const db = createDb(env.DB);
  return new GenerateSuggestions({
    papers: new DrizzlePaperRepository(db),
    profiles: new DrizzleProfileRepository(db),
    source: new CompositeSuggestionSource([
      new S2RecommendationsSource(env.S2_API_KEY || undefined),
      new ArxivRecentSource(),
      new OpenAlexSource(),
    ]),
    ranker: new LlmSuggestionRanker(openaiGateway(env), GPT_MID),
    suggestions: new DrizzleSuggestionRepository(db),
  });
};

export const buildSuggestionRepo = (env: Env): DrizzleSuggestionRepository =>
  new DrizzleSuggestionRepository(createDb(env.DB));

export const buildProfileRepo = (env: Env): DrizzleProfileRepository =>
  new DrizzleProfileRepository(createDb(env.DB));

export const buildNoteRepo = (env: Env): DrizzleNoteRepository =>
  new DrizzleNoteRepository(createDb(env.DB));
