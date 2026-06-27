import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { detectIngestInput } from "../../infrastructure/ingestion/input";
import { AppError, httpStatusForKind } from "../../shared/errors";
import {
  buildAnswerQuestion,
  buildExplainSelection,
  buildGenerateSuggestions,
  buildIngestionQueue,
  buildIngestPaper,
  buildLibrary,
  buildNoteRepo,
  buildProfileRepo,
  buildQaHistory,
  buildSuggestionRepo,
  buildSummarizePaper,
} from "./composition";
import { type AuthEnv, requireAuth, withAuth } from "./middleware/auth";

const explainSchema = z.object({
  selectedText: z.string().min(1).max(4000),
  context: z.string().max(8000).optional(),
  section: z.string().max(200).optional(),
  page: z.number().int().nonnegative().optional(),
  lang: z.enum(["ja", "en"]).optional(),
});

/**
 * HTTP boundary. Routes are defined with method chaining so the inferred
 * `AppType` can drive an end-to-end-typed Hono RPC client. No business logic
 * lives here — handlers delegate to application use cases; domain errors map to
 * HTTP status centrally.
 */
const app = new Hono<AuthEnv>();

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: err.kind, message: err.message },
      httpStatusForKind[err.kind] as ContentfulStatusCode,
    );
  }
  console.error(err);
  return c.json({ error: "internal" }, 500);
});

app.use("/api/*", withAuth);
app.on(["GET", "POST"], "/api/auth/*", (c) => c.get("auth").handler(c.req.raw));

const routes = app
  .get("/api/health", (c) =>
    c.json({
      status: "ok" as const,
      service: "eyday-paper" as const,
      time: new Date().toISOString(),
    }),
  )
  .get("/api/me", requireAuth, (c) => {
    const me = c.get("me");
    return c.json({
      userId: c.get("ctx").userId,
      name: me.name,
      email: me.email,
      image: me.image,
    });
  })
  // Ingest a paper from arXiv id / DOI / URL. Heavy processing runs async.
  .post(
    "/api/papers",
    requireAuth,
    zValidator("json", z.object({ input: z.string().min(1).max(2048) })),
    async (c) => {
      const detected = detectIngestInput(c.req.valid("json").input);
      const result = await buildIngestPaper(c.env).execute(c.get("ctx").userId, detected);
      return c.json(result, result.deduped ? 200 : 201);
    },
  )
  // Upload a PDF file (drag & drop / file picker). Stored in R2; text extracted async.
  .post("/api/papers/upload", requireAuth, async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("validation", "no file uploaded");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw new AppError("validation", "only PDF files are supported");
    if (file.size === 0) throw new AppError("validation", "empty file");
    if (file.size > 30 * 1024 * 1024) throw new AppError("validation", "file too large (max 30MB)");
    const result = await buildIngestPaper(c.env).execute(c.get("ctx").userId, {
      kind: "pdf",
      value: "",
      filename: file.name,
      pdfBytes: await file.arrayBuffer(),
    });
    return c.json(result, result.deduped ? 200 : 201);
  })
  // List the user's library.
  .get("/api/papers", requireAuth, async (c) => {
    const list = await buildLibrary(c.env).papers.list(c.get("ctx").userId);
    return c.json({ papers: list });
  })
  // Paper detail with tags + home folder.
  .get("/api/papers/:id", requireAuth, async (c) => {
    const { papers, tags, folders, chunks } = buildLibrary(c.env);
    const userId = c.get("ctx").userId;
    const id = c.req.param("id");
    const paper = await papers.findById(userId, id);
    if (!paper) throw new AppError("not_found", "paper not found");
    const paperTags = await tags.listForPaper(userId, id);
    const folder = paper.primaryFolderId
      ? await folders.findById(userId, paper.primaryFolderId)
      : null;
    // `indexed` = has searchable chunks; drives the reader's re-index affordance.
    const indexed = (await chunks.countByPaper(userId, id)) > 0;
    return c.json({ paper, tags: paperTags, folder, indexed });
  })
  // Structured reflow text (R2). 409 until processing has produced it.
  .get("/api/papers/:id/text", requireAuth, async (c) => {
    const { papers, storage } = buildLibrary(c.env);
    const paper = await papers.findById(c.get("ctx").userId, c.req.param("id"));
    if (!paper) throw new AppError("not_found", "paper not found");
    const text = paper.textR2Key ? await storage.getText(paper.textR2Key) : null;
    if (!text) throw new AppError("conflict", "text not ready");
    return c.body(text, 200, { "content-type": "application/json" });
  })
  // Original PDF (the "understudy"), always one tap away.
  .get("/api/papers/:id/pdf", requireAuth, async (c) => {
    const { papers, storage } = buildLibrary(c.env);
    const paper = await papers.findById(c.get("ctx").userId, c.req.param("id"));
    const obj = paper?.pdfR2Key ? await storage.get(paper.pdfR2Key) : null;
    if (!obj) throw new AppError("not_found", "pdf not found");
    return c.body(obj.body, 200, { "content-type": obj.contentType ?? "application/pdf" });
  })
  // Explain-on-selection of a passage/figure/formula.
  .post("/api/papers/:id/explain", requireAuth, zValidator("json", explainSchema), async (c) => {
    const b = c.req.valid("json");
    const result = await buildExplainSelection(c.env).execute({
      userId: c.get("ctx").userId,
      paperId: c.req.param("id"),
      selectedText: b.selectedText,
      context: b.context ?? null,
      section: b.section ?? null,
      page: b.page ?? null,
      lang: b.lang ?? "ja",
    });
    return c.json(result);
  })
  // RAG Q&A grounded in the paper's chunks (cited source spans).
  .post(
    "/api/papers/:id/qa",
    requireAuth,
    zValidator(
      "json",
      z.object({ question: z.string().min(1).max(2000), lang: z.enum(["ja", "en"]).optional() }),
    ),
    async (c) => {
      const b = c.req.valid("json");
      const result = await buildAnswerQuestion(c.env).execute({
        userId: c.get("ctx").userId,
        paperId: c.req.param("id"),
        question: b.question,
        lang: b.lang ?? "ja",
      });
      return c.json(result);
    },
  )
  // Q&A history for a paper.
  .get("/api/papers/:id/qa", requireAuth, async (c) => {
    const messages = await buildQaHistory(c.env).listByPaper(
      c.get("ctx").userId,
      c.req.param("id"),
    );
    return c.json({ messages });
  })
  // TL;DR + section summaries (cached per lang). ?lang=ja|en.
  .get("/api/papers/:id/summary", requireAuth, async (c) => {
    const lang = c.req.query("lang") === "en" ? "en" : "ja";
    const summary = await buildSummarizePaper(c.env).execute({
      userId: c.get("ctx").userId,
      paperId: c.req.param("id"),
      lang,
    });
    return c.json(summary);
  })
  // Suggestions (cached by the daily batch), grouped classic/recent.
  .get("/api/suggestions", requireAuth, async (c) => {
    const all = await buildSuggestionRepo(c.env).list(c.get("ctx").userId);
    return c.json({
      classic: all.filter((s) => s.kind === "classic"),
      recent: all.filter((s) => s.kind === "recent"),
    });
  })
  // Manually refresh suggestions. Runs synchronously and returns the count:
  // external fetches + the LLM ranker are time-bounded (fetch timeouts) and the
  // ranker is non-fatal (heuristic fallback), so it finishes within one request
  // and the client gets a definitive result (no polling).
  .post("/api/suggestions/refresh", requireAuth, async (c) => {
    const count = await buildGenerateSuggestions(c.env).execute(c.get("ctx").userId);
    return c.json({ count });
  })
  // Import a suggestion: ingest server-side from the best identifier
  // (arXiv > DOI > URL); only mark imported once ingestion succeeds.
  .post("/api/suggestions/:id/import", requireAuth, async (c) => {
    const userId = c.get("ctx").userId;
    const id = c.req.param("id");
    const repo = buildSuggestionRepo(c.env);
    const sug = await repo.findById(userId, id);
    if (!sug) throw new AppError("not_found", "suggestion not found");
    const input = sug.arxivId ?? sug.doi ?? sug.url;
    if (!input) throw new AppError("validation", "suggestion has no importable identifier");
    const result = await buildIngestPaper(c.env).execute(userId, detectIngestInput(input));
    await repo.markImported(userId, id);
    return c.json({ paperId: result.paperId, deduped: result.deduped });
  })
  .post("/api/suggestions/:id/dismiss", requireAuth, async (c) => {
    await buildSuggestionRepo(c.env).dismiss(c.get("ctx").userId, c.req.param("id"));
    return c.json({ ok: true });
  })
  // Profile (interests / level / readability / output language).
  .get("/api/profile", requireAuth, async (c) => {
    const profile = await buildProfileRepo(c.env).get(c.get("ctx").userId);
    return c.json({ profile });
  })
  .put(
    "/api/profile",
    requireAuth,
    zValidator(
      "json",
      z.object({
        interests: z.array(z.string().min(1).max(60)).max(50).optional(),
        domains: z.array(z.string().min(1).max(60)).max(50).optional(),
        organizations: z.array(z.string().min(1).max(80)).max(50).optional(),
        avoid: z.array(z.string().min(1).max(60)).max(50).optional(),
        goal: z.string().max(500).nullish(),
        level: z.string().max(60).nullish(),
        readability: z.string().max(60).nullish(),
        outputLang: z.enum(["ja", "en"]).optional(),
      }),
    ),
    async (c) => {
      const profile = await buildProfileRepo(c.env).upsert(
        c.get("ctx").userId,
        c.req.valid("json"),
      );
      return c.json({ profile });
    },
  )
  // Folder tree (manual organization).
  .get("/api/folders", requireAuth, async (c) => {
    const folders = await buildLibrary(c.env).folders.list(c.get("ctx").userId);
    return c.json({ folders });
  })
  // Reading status (manual).
  .patch(
    "/api/papers/:id/status",
    requireAuth,
    zValidator("json", z.object({ status: z.enum(["unread", "reading", "read"]) })),
    async (c) => {
      await buildLibrary(c.env).papers.setStatus(
        c.get("ctx").userId,
        c.req.param("id"),
        c.req.valid("json").status,
      );
      return c.json({ ok: true });
    },
  )
  // Manual move to a home folder (respected by automation thereafter).
  .patch(
    "/api/papers/:id/folder",
    requireAuth,
    zValidator("json", z.object({ folderId: z.string().nullable() })),
    async (c) => {
      await buildLibrary(c.env).papers.setPrimaryFolder(
        c.get("ctx").userId,
        c.req.param("id"),
        c.req.valid("json").folderId,
      );
      return c.json({ ok: true });
    },
  )
  // Rebuild a paper's search index: re-run the processing pipeline
  // (extract → chunk → embed → index). Recovers papers left un-indexed by a
  // transient failure during ingestion, so Q&A has chunks to retrieve.
  .post("/api/papers/:id/reprocess", requireAuth, async (c) => {
    const userId = c.get("ctx").userId;
    const id = c.req.param("id");
    const paper = await buildLibrary(c.env).papers.findById(userId, id);
    if (!paper) throw new AppError("not_found", "paper not found");
    // Heavy work (extract → chunk → embed → index) runs in the queue consumer,
    // which has generous limits + retries; the client polls `indexed`.
    await buildIngestionQueue(c.env).enqueueProcess({ userId, paperId: id });
    return c.json({ ok: true });
  })
  // Notes / highlights.
  .get("/api/papers/:id/notes", requireAuth, async (c) => {
    const notes = await buildNoteRepo(c.env).listByPaper(c.get("ctx").userId, c.req.param("id"));
    return c.json({ notes });
  })
  .post(
    "/api/papers/:id/notes",
    requireAuth,
    zValidator(
      "json",
      z.object({
        kind: z.enum(["note", "highlight"]).default("note"),
        body: z.string().max(8000).optional(),
        rangeJson: z.string().max(4000).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid("json");
      const note = await buildNoteRepo(c.env).create({
        id: crypto.randomUUID(),
        userId: c.get("ctx").userId,
        paperId: c.req.param("id"),
        kind: b.kind,
        body: b.body ?? null,
        rangeJson: b.rangeJson ?? null,
      });
      return c.json({ note }, 201);
    },
  )
  .delete("/api/notes/:id", requireAuth, async (c) => {
    await buildNoteRepo(c.env).delete(c.get("ctx").userId, c.req.param("id"));
    return c.json({ ok: true });
  });

export type AppType = typeof routes;
export { app };
