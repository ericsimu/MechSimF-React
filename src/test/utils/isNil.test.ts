import { describe, it, expect } from "vitest";
import { isNil } from "../../utils/isNil";

describe("isNil", () => {
  it("returns true for null", () => {
    expect(isNil(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isNil(undefined)).toBe(true);
  });

  it("returns false for 0", () => {
    expect(isNil(0)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isNil("")).toBe(false);
  });

  it("returns false for false", () => {
    expect(isNil(false)).toBe(false);
  });

  it("returns false for objects", () => {
    expect(isNil({})).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isNil([])).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isNil(NaN)).toBe(false);
  });
});
