/** Opaque, URL-safe identifier generation. Uses the runtime crypto. */
export const newId = (): string => crypto.randomUUID();
