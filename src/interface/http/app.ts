import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { detectIngestInput } from "../../infrastructure/ingestion/input";
import { AppError, httpStatusForKind } from "../../shared/errors";
import { buildIngestPaper } from "./composition";
import { type AuthEnv, requireAuth, withAuth } from "./middleware/auth";

/**
 * HTTP boundary. Routes are defined with method chaining so the inferred
 * `AppType` can drive an end-to-end-typed Hono RPC client. No business logic
 * lives here — handlers delegate to application use cases; domain errors are
 * mapped to HTTP status centrally.
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

// Build Better Auth once per request for every API route.
app.use("/api/*", withAuth);

// Better Auth endpoints: sign-in/out, Google OAuth callback, session.
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
  );

export type AppType = typeof routes;
export { app };
