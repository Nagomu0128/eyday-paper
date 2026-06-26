/** Polite contact string for external APIs (Crossref/OpenAlex polite pool). */
const USER_AGENT = "eyday-paper/0.1 (https://eyday-paper.yoshidakazuya.com)";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  /** Per-attempt timeout. Without it a hung endpoint stalls the whole pipeline. */
  timeoutMs?: number;
  /** Retry on HTTP 429 (default true). Turn off for quota-limited LLM calls,
   *  where a 429 won't recover within the backoff window — retrying just
   *  multiplies provider requests. */
  retryOn429?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fetch with a per-attempt timeout + exponential backoff on 429/5xx, to avoid
 * both hangs (a stuck external API / AI Gateway must never freeze ingestion or
 * the suggestion batch) and retry storms. Adds a UA identifying the app.
 */
export const fetchWithRetry = async (
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> => {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const retryOn429 = opts.retryOn429 ?? true;
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
      const retryable = res.status >= 500 || (res.status === 429 && retryOn429);
      if (retryable && attempt < retries) {
        await sleep(base * 2 ** attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(base * 2 ** attempt);
      }
    }
  }
  throw lastError ?? new Error(`fetch failed: ${url}`);
};
