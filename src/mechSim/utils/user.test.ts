import { describe, it, expect, beforeEach } from "vitest";
import { getCurrentUser, setCurrentUser } from "./user";

describe("user", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getCurrentUser", () => {
    it("returns default user1 when not set", () => {
      expect(getCurrentUser()).toBe("user1");
    });

    it("returns the stored user", () => {
      localStorage.setItem("current_user", "zhangsan");
      expect(getCurrentUser()).toBe("zhangsan");
    });
  });

  describe("setCurrentUser", () => {
    it("stores the username", () => {
      setCurrentUser("lisi");
      expect(localStorage.getItem("current_user")).toBe("lisi");
    });
  });
});
