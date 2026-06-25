/**
 * Domain-level error taxonomy. Layers return these (via Result) and only the
 * interface edge translates `kind` into an HTTP status. Never leak secrets in
 * `message`.
 */
export type ErrorKind =
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "upstream"
  | "internal";

export class AppError extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.kind = kind;
  }
}

export const httpStatusForKind: Record<ErrorKind, number> = {
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  conflict: 409,
  rate_limited: 429,
  upstream: 502,
  internal: 500,
};
