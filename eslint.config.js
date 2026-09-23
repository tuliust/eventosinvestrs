import tseslint from "typescript-eslint"

export default [
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".figma/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "e2e/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error"
    },
  },
]
