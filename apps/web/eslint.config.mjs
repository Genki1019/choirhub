import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setHours|setMinutes|setDate|setMonth|setFullYear|toLocaleDateString|toLocaleTimeString)$/]",
          message:
            "日付・時刻はブラウザのタイムゾーンで扱わず、lib/date.ts の日本時間のヘルパー（jstParts・formatJaDate・formatShortDate・todayStr など）を使ってください。",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
