/**
 * Per-request, authenticated context. Carries the tenant boundary (`userId`)
 * that every downstream query must filter by. Kept in `shared` as a plain type
 * (no layer dependencies); the interface edge populates it from the session.
 */
export interface RequestContext {
  readonly userId: string;
}
