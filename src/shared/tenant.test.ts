import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { assertOwnedBy } from "./tenant";

describe("assertOwnedBy", () => {
  it("passes when the resource belongs to the requester", () => {
    expect(() => assertOwnedBy("user-1", "user-1")).not.toThrow();
  });

  it("throws forbidden on cross-tenant access", () => {
    try {
      assertOwnedBy("user-1", "user-2");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).kind).toBe("forbidden");
    }
  });
});
