import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns ok with service identity", async () => {
    const res = await SELF.fetch("https://eyday-paper.test/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; time: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("eyday-paper");
    expect(typeof body.time).toBe("string");
  });
});
