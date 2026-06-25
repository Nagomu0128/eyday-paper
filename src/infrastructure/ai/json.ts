/** Parse JSON that an LLM may have wrapped in a ```json fence; null on failure. */
export const parseLlmJson = (raw: string): unknown => {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
};
