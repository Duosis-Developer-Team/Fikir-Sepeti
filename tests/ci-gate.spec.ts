import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test.describe("ci gate", () => {
  test("deploy workflow requires successful CI on main", () => {
    const yml = readFileSync(
      join(process.cwd(), ".github/workflows/deploy.yml"),
      "utf8"
    );
    expect(yml).toContain("workflow_run");
    expect(yml).toContain('workflows: ["CI"]');
    expect(yml).toContain("conclusion == 'success'");
    expect(yml).toContain("head_branch == 'main'");
    // Deploy must NOT trigger solely from unconditional push to main
    expect(yml).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/);
  });
});
