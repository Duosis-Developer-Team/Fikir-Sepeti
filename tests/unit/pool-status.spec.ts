import { test, expect } from "@playwright/test";
import type { PoolStatus } from "../../lib/types";

const STATUS_LABEL: Record<PoolStatus, string> = {
  new: "yeni",
  voting: "oylanıyor",
  promoted: "organize edildi",
  archived: "arşiv",
  rejected: "reddedildi",
};

test.describe("S4 pool status machine labels", () => {
  test("covers full status set", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(
      ["archived", "new", "promoted", "rejected", "voting"].sort()
    );
    expect(STATUS_LABEL.promoted).toContain("organize");
  });
});
