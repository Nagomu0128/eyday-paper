import { describe, expect, it } from "vitest";
import { dueForSuggestions } from "../src/application/suggestion/due";

describe("dueForSuggestions (per-user cron gating)", () => {
  it("defaults to 07:00 JST (22:00 UTC) when no hour is set", () => {
    expect(dueForSuggestions(null, 22)).toBe(true); // 22 UTC = 07 JST
    expect(dueForSuggestions(null, 0)).toBe(false); // 00 UTC = 09 JST
  });

  it("matches the user's configured JST hour", () => {
    expect(dueForSuggestions(9, 0)).toBe(true); // 00 UTC = 09 JST
    expect(dueForSuggestions(23, 14)).toBe(true); // 14 UTC = 23 JST
    expect(dueForSuggestions(0, 15)).toBe(true); // 15 UTC = 24 → 00 JST
    expect(dueForSuggestions(8, 22)).toBe(false); // 22 UTC = 07 JST ≠ 08
  });

  it("wraps around midnight correctly for every UTC hour", () => {
    for (let utc = 0; utc < 24; utc++) {
      const jst = (utc + 9) % 24;
      expect(dueForSuggestions(jst, utc)).toBe(true);
      expect(dueForSuggestions((jst + 1) % 24, utc)).toBe(false);
    }
  });
});
