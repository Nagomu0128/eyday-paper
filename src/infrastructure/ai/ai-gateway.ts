import { AppError } from "../../shared/errors";
import { fetchWithRetry } from "../http/fetch-retry";
import type { LlmClient, LlmCompleteOptions } from "./llm-client";

export interface AiGatewayConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Routes all OpenAI/Gemini calls through Cloudflare AI Gateway (OpenAI-compatible
 * base-URL swap) to get response caching, cost analytics, rate limits, retries,
 * and dollar spend limits in one place.
 * NOTE: verify the provider path of `baseUrl` against current AI Gateway docs
 * before deploy (e.g. `.../google-ai-studio/v1beta/openai`).
 */
export class AiGatewayLlmClient implements LlmClient {
  constructor(private readonly config: AiGatewayConfig) {}

  async complete(opts: LlmCompleteOptions): Promise<string> {
    const res = await fetchWithRetry(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      },
      // Don't multiply provider requests on a quota/rate 429; one transient-5xx retry.
      { retries: 1, retryOn429: false, timeoutMs: 20_000 },
    );
    if (!res.ok) {
      // Surface the provider/gateway reason (model not found, gateway missing,
      // auth/quota) to observability; keep the client-facing error generic.
      const body = await res.text().catch(() => "");
      console.error(`AI gateway ${res.status} (model ${opts.model}): ${body.slice(0, 300)}`);
      throw new AppError("upstream", `LLM gateway ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

/** Build an AI Gateway base URL for a provider (account + gateway from secrets). */
export const buildGatewayBaseUrl = (
  accountId: string,
  gateway: string,
  providerPath: string,
): string => `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/${providerPath}`;
