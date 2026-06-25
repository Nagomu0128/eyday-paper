import { Hono } from "hono";

/**
 * HTTP boundary. Routes are defined with method chaining so the inferred
 * `AppType` can drive an end-to-end-typed Hono RPC client (`hc<AppType>`).
 * No business logic lives here — handlers delegate to application use cases.
 */
const app = new Hono<{ Bindings: Env }>().get("/api/health", (c) =>
  c.json({
    status: "ok" as const,
    service: "eyday-paper" as const,
    time: new Date().toISOString(),
  }),
);

export type AppType = typeof app;
export { app };
