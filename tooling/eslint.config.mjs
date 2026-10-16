import tsparser from "@typescript-eslint/parser";
import path from "path";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

const rootDir = path.resolve(import.meta.dirname, "..");

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "plugin/**",
      "node_modules/**",
      "scripts/**",
      "tooling/**",
      "src/**/*.js",
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        activeDocument: "writable",
        activeWindow: "writable",
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: path.join(rootDir, "tsconfig.json"),
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": ["error", { ignoreRestArgs: true }],
      // Type assertions are erased at runtime, so removing a redundant one is
      // provably behaviour-preserving. The community-plugin review reports 63
      // of these; keep them surfaced here instead.
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    },
  },
]);
