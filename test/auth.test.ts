import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("auth wiring + tenant guard", () => {
  it("rejects a protected route without a session (401)", async () => {
    const res = await SELF.fetch("https://eyday-paper.test/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("serves Better Auth get-session (200, null session) against the migrated schema", async () => {
    const res = await SELF.fetch("https://eyday-paper.test/api/auth/get-session");
    expect(res.status).toBe(200);
  });
});
