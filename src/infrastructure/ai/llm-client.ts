export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  /** Request strict JSON output (OpenAI-compatible response_format). */
  json?: boolean;
}

/** OpenAI-compatible chat completion. Implemented over Cloudflare AI Gateway. */
export interface LlmClient {
  complete(opts: LlmCompleteOptions): Promise<string>;
}
