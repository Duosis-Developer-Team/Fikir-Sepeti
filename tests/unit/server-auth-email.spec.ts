import { test, expect } from "@playwright/test";
import { emailFromAuthUser } from "../../lib/server-auth";
import type { User } from "@supabase/supabase-js";

test.describe("emailFromAuthUser", () => {
  test("uses primary email lowercased", () => {
    const user = { email: "Admin@DuoSis.COM", identities: [] } as unknown as User;
    expect(emailFromAuthUser(user)).toBe("admin@duosis.com");
  });

  test("falls back to identity_data email", () => {
    const user = {
      email: null,
      identities: [
        { identity_data: { email: "azure.user@duosis.com" } },
      ],
    } as unknown as User;
    expect(emailFromAuthUser(user)).toBe("azure.user@duosis.com");
  });
});
