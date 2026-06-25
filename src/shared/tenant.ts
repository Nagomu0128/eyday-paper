import { AppError } from "./errors";

/**
 * Tenant-isolation guard. Repositories already force a `user_id` filter; this is
 * the belt-and-braces check for code paths that load a resource and must confirm
 * it belongs to the requester before returning or mutating it.
 */
export const assertOwnedBy = (resourceUserId: string, requesterUserId: string): void => {
  if (resourceUserId !== requesterUserId) {
    throw new AppError("forbidden", "cross-tenant access denied");
  }
};
