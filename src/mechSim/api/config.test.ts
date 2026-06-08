import { describe, it, expect } from "vitest";
import { API_BASE } from "./config";

describe("API_BASE", () => {
  it("defaults to /api/v1/sim", () => {
    expect(API_BASE).toBe("/api/v1/sim");
  });
});
