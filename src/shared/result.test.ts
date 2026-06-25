import { describe, expect, it } from "vitest";
import { err, isErr, isOk, map, mapErr, ok, unwrapOr } from "./result";

describe("Result", () => {
  it("constructs ok / err and narrows", () => {
    const a = ok(1);
    const b = err("boom");
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
    if (isOk(a)) expect(a.value).toBe(1);
    if (isErr(b)) expect(b.error).toBe("boom");
  });

  it("map transforms success only", () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(map(err<string>("e"), (n: number) => n * 3)).toEqual(err("e"));
  });

  it("mapErr transforms error only", () => {
    expect(mapErr(err("e"), (e) => `${e}!`)).toEqual(err("e!"));
    expect(mapErr(ok(2), (e: string) => `${e}!`)).toEqual(ok(2));
  });

  it("unwrapOr falls back on error", () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err("e"), 0)).toBe(0);
  });
});
