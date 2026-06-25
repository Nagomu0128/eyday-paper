/** Polite contact string for external APIs (Crossref/OpenAlex polite pool). */
const USER_AGENT = "eyday-paper/0.1 (https://eyday-paper.yoshidakazuya.com)";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fetch with exponential backoff on 429/5xx to avoid retry storms against polite
 * external APIs. Adds a UA identifying the app.
 */
export const fetchWithRetry = async (
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> => {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
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
