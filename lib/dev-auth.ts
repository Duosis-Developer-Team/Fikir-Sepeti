/** Shared password for seeded local/CI auth users (S3 RLS bridge). */
export const DEV_AUTH_PASSWORD =
  process.env.NEXT_PUBLIC_DEV_AUTH_PASSWORD || "test-password-123";
