import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { detectIngestInput } from "../../infrastructure/ingestion/input";
import { AppError, httpStatusForKind } from "../../shared/errors";
import {
  buildAnswerQuestion,
  buildExplainSelection,
  buildIngestPaper,
  buildLibrary,
  buildQaHistory,
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
  .get("/api/me", requireAuth, (c) => c.json({ userId: c.get("ctx").userId }))
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
  // List the user's library.
  .get("/api/papers", requireAuth, async (c) => {
    const list = await buildLibrary(c.env).papers.list(c.get("ctx").userId);
    return c.json({ papers: list });
  })
  // Paper detail with tags + home folder.
  .get("/api/papers/:id", requireAuth, async (c) => {
    const { papers, tags, folders } = buildLibrary(c.env);
    const userId = c.get("ctx").userId;
    const id = c.req.param("id");
    const paper = await papers.findById(userId, id);
    if (!paper) throw new AppError("not_found", "paper not found");
    const paperTags = await tags.listForPaper(userId, id);
    const folder = paper.primaryFolderId
      ? await folders.findById(userId, paper.primaryFolderId)
      : null;
    return c.json({ paper, tags: paperTags, folder });
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
  });

export type AppType = typeof routes;
export { app };
