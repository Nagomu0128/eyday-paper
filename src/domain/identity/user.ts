/**
 * Identity domain. Pure TypeScript — no framework, no I/O. `UserId` is a branded
 * string so a raw string can't be passed where a tenant id is required.
 */
export type UserId = string & { readonly __brand: "UserId" };

export const UserId = (value: string): UserId => {
  if (value.length === 0) {
    throw new Error("UserId must be a non-empty string");
  }
  return value as UserId;
};

export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  /** Stable Google identifier (OIDC `sub`); null until first Google sign-in. */
  readonly googleSub: string | null;
}
