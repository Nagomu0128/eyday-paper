import { eq } from "drizzle-orm";
import { dueForSuggestions } from "./application/suggestion/due";
import { createDb } from "./db/client";
import { profile, user } from "./db/schema";
import type { ProcessJob } from "./domain/ingestion/ports";
import { app } from "./interface/http/app";
import { buildGenerateSuggestions, buildProcessPaper } from "./interface/http/composition";

/**
 * Single Worker entry. `fetch` serves the Hono API (static assets are served by
 * the platform for non-`/api/*`). `queue` consumes ingestion jobs and runs the
 * heavy processing pipeline off the request path. `scheduled` runs the daily
 * suggestion batch and caches results to D1.
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

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    // Hourly cron: run the batch only for users whose configured JST hour is now.
    const nowUtcHour = new Date(event.scheduledTime).getUTCHours();
    const rows = await createDb(env.DB)
      .select({ id: user.id, suggestHour: profile.suggestHour })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id));
    const generate = buildGenerateSuggestions(env);
    for (const u of rows) {
      if (!dueForSuggestions(u.suggestHour ?? null, nowUtcHour)) continue;
      try {
        await generate.execute(u.id);
      } catch (error) {
        console.error("suggestion batch failed for user", u.id, error);
      }
    }
  },
} satisfies ExportedHandler<Env, ProcessJob>;

export type { AppType } from "./interface/http/app";
