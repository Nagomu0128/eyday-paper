import type { IngestionQueue, ProcessJob } from "../../domain/ingestion/ports";

/** Producer adapter over the Cloudflare Queue binding. */
export class CloudflareIngestionQueue implements IngestionQueue {
  constructor(private readonly queue: Queue<ProcessJob>) {}

  async enqueueProcess(job: ProcessJob): Promise<void> {
    await this.queue.send(job);
  }
}
