/**
 * Per-user, per-day usage limiter. Keeps expensive LLM endpoints from running
 * away (cost / abuse). The "day" is a calendar day in JST; counters reset at the
 * JST date boundary. Implemented over KV in infrastructure.
 */
export interface RateLimiter {
  /**
   * Atomically-ish increment the user's daily counter for `bucket` and report
   * whether this call is within `limit`. When already at the limit, does not
   * increment and returns `allowed: false`.
   */
  checkAndIncrement(
    userId: string,
    bucket: string,
    limit: number,
  ): Promise<{ allowed: boolean; remaining: number }>;
}
