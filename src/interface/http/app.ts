import { Hono } from "hono";
import { type AuthEnv, requireAuth, withAuth } from "./middleware/auth";

/**
 * HTTP boundary. Routes are defined with method chaining so the inferred
 * `AppType` can drive an end-to-end-typed Hono RPC client. No business logic
 * lives here — handlers delegate to application use cases.
 */
const app = new Hono<AuthEnv>();

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
  // Protected: proves the auth guard + tenant context wiring.
  .get("/api/me", requireAuth, (c) => c.json({ userId: c.get("ctx").userId }));

export type AppType = typeof routes;
export { app };
