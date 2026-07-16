import { test, expect } from "@playwright/test";
import { checkContent } from "../../lib/moderation";

test.describe("S9 moderation helpers", () => {
  test("word rule warns by default", () => {
    const r = checkContent("bu bir spam fikir", [
      { id: "1", pattern: "spam", kind: "word", action: "warn" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.action).toBe("warn");
    expect(r.hits[0].matched.toLowerCase()).toContain("spam");
  });

  test("block wins over warn", () => {
    const r = checkContent("spam ve yasak", [
      { id: "1", pattern: "spam", kind: "word", action: "warn" },
      { id: "2", pattern: "yasak", kind: "word", action: "block" },
    ]);
    expect(r.action).toBe("block");
  });

  test("clean text ok", () => {
    const r = checkContent("pizza yiyelim", [
      { id: "1", pattern: "spam", kind: "word", action: "warn" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.action).toBeNull();
  });
});
