import { describe, it, expect } from "vitest";
import { isTauri, invoke } from "./tauri";

describe("isTauri", () => {
  it("returns false in jsdom (no __TAURI_INTERNALS__)", () => {
    expect(isTauri()).toBe(false);
  });
});

describe("invoke", () => {
  it("rejects with a clear error when not running under Tauri", async () => {
    await expect(invoke("anything")).rejects.toThrow(/Tauri not available/);
  });
});
