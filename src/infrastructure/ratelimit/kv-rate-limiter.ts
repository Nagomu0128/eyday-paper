import type { RateLimiter } from "../../domain/ratelimit/ports";

/** Calendar day in JST (UTC+9) as YYYY-MM-DD — the counter's reset boundary. */
const jstDay = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * KV-backed daily limiter. Key: `rl:{bucket}:{userId}:{JST-date}`, value = count,
 * TTL 48h so yesterday's keys self-clean. KV is eventually consistent, so under
 * heavy concurrency the count can undercount slightly — acceptable for soft
 * personal-usage caps (it never over-blocks within a single request flow).
 */
export class KvRateLimiter implements RateLimiter {
  constructor(private readonly kv: KVNamespace) {}

  async checkAndIncrement(
    userId: string,
    bucket: string,
    limit: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rl:${bucket}:${userId}:${jstDay()}`;
    const current = Number((await this.kv.get(key)) ?? "0") || 0;
    if (current >= limit) return { allowed: false, remaining: 0 };
    const next = current + 1;
    await this.kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 });
    return { allowed: true, remaining: Math.max(0, limit - next) };
  }
}
