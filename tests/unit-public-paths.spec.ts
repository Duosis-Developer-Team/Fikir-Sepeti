import { test, expect } from "@playwright/test";
import { isPublicPath } from "../lib/public-paths";

test.describe("public paths helper", () => {
  test("allows landing, login, register", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
  });

  test("rejects protected routes", () => {
    expect(isPublicPath("/archive")).toBe(false);
    expect(isPublicPath("/basket/abc")).toBe(false);
    expect(isPublicPath(null)).toBe(false);
  });
});
