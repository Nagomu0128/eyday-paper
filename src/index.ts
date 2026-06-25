import type { ProcessJob } from "./domain/ingestion/ports";
import { app } from "./interface/http/app";
import { buildProcessPaper } from "./interface/http/composition";

/**
 * Single Worker entry. `fetch` serves the Hono API (static assets are served by
 * the platform for non-`/api/*`). `queue` consumes ingestion jobs and runs the
 * heavy processing pipeline off the request path.
 */
export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  async queue(batch: MessageBatch<ProcessJob>, env: Env): Promise<void> {
    const processor = buildProcessPaper(env);
    for (const message of batch.messages) {
      try {
        await processor.execute(message.body);
        message.ack();
      } catch (error) {
        console.error("ingestion processing failed", error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, ProcessJob>;

export type { AppType } from "./interface/http/app";
