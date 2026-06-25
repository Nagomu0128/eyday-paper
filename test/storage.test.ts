import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { r2Keys } from "../src/domain/storage/keys";
import { R2ObjectStorage } from "../src/infrastructure/storage/r2-object-storage";

describe("R2ObjectStorage", () => {
  it("put/get/getText/delete with tenant-scoped keys", async () => {
    const store = new R2ObjectStorage(env.BUCKET);
    const key = r2Keys.text("user-1", "paper-1");
    expect(key).toBe("text/user-1/paper-1.json");

    await store.put(key, JSON.stringify({ hello: "world" }), "application/json");

    expect(await store.getText(key)).toBe('{"hello":"world"}');
    const obj = await store.get(key);
    expect(obj?.contentType).toBe("application/json");
    expect(new TextDecoder().decode(obj?.body)).toContain("world");

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    expect(await store.getText(key)).toBeNull();
  });
});
