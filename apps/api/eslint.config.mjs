import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["dist/**", "src/generated/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setHours|setMinutes|setDate|setMonth|setFullYear)$/]",
          message:
            "日付・時刻はサーバーのタイムゾーンで扱わず、lib/date.ts の日本時間のヘルパー（toJstDateString・jstDayStart など）を使ってください。",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^toLocale(Date|Time)?String$/]:not(:has(Property[key.name='timeZone']))",
          message: '日付・時刻を文字列にするときは timeZone: "Asia/Tokyo" を指定してください。',
        },
      ],
    },
  },
);
