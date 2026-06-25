import { app } from "./interface/http/app";

// Single Worker entry: serves the Hono API. Static assets (the React client)
// are served by the platform via the `assets` config; the Worker only runs for
// `/api/*` (see wrangler.jsonc `run_worker_first`).
export default app;

export type { AppType } from "./interface/http/app";
