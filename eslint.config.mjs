import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "Design system documentation/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // Existing data-fetch/subscribe effects use setState; keep as warning until refactor.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
