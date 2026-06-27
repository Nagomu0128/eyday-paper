import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db/client";
import {
  DrizzleNoteRepository,
  DrizzlePaperRepository,
} from "../src/infrastructure/repositories/library";
import { seedUser } from "./helpers";

describe("DrizzleNoteRepository", () => {
  it("creates/lists/deletes notes scoped by user", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const notes = new DrizzleNoteRepository(db);
    const u1 = await seedUser();
    const u2 = await seedUser();
    const p = await papers.create({ id: crypto.randomUUID(), userId: u1, title: "P" });

    const n = await notes.create({
      id: crypto.randomUUID(),
      userId: u1,
      paperId: p.id,
      kind: "note",
      body: "hello",
    });
    expect(n.body).toBe("hello");
    expect(await notes.listByPaper(u1, p.id)).toHaveLength(1);
    expect(await notes.listByPaper(u2, p.id)).toHaveLength(0);

    // Other tenant cannot delete it.
    await notes.delete(u2, n.id);
    expect(await notes.listByPaper(u1, p.id)).toHaveLength(1);

    await notes.delete(u1, n.id);
    expect(await notes.listByPaper(u1, p.id)).toHaveLength(0);
  });

  it("edits a note's body and stamps updatedAt", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const notes = new DrizzleNoteRepository(db);
    const u = await seedUser();
    const p = await papers.create({ id: crypto.randomUUID(), userId: u, title: "P" });
    const n = await notes.create({
      id: crypto.randomUUID(),
      userId: u,
      paperId: p.id,
      kind: "note",
      body: "first",
    });
    expect(n.updatedAt).toBeNull();

    await notes.update(u, n.id, { body: "edited" });

    const after = (await notes.listByPaper(u, p.id)).find((x) => x.id === n.id);
    expect(after?.body).toBe("edited");
    expect(after?.updatedAt).toBeInstanceOf(Date);
  });

  it("does not edit another tenant's note", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const notes = new DrizzleNoteRepository(db);
    const owner = await seedUser();
    const attacker = await seedUser();
    const p = await papers.create({ id: crypto.randomUUID(), userId: owner, title: "P" });
    const n = await notes.create({
      id: crypto.randomUUID(),
      userId: owner,
      paperId: p.id,
      kind: "note",
      body: "secret",
    });

    await notes.update(attacker, n.id, { body: "hacked" });

    const after = (await notes.listByPaper(owner, p.id)).find((x) => x.id === n.id);
    expect(after?.body).toBe("secret"); // unchanged
    expect(after?.updatedAt).toBeNull();
  });
});
