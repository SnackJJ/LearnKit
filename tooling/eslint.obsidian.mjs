/**
 * Full-surface Obsidian lint.
 *
 * `npm run lint` runs eslint-plugin-obsidianmd's `recommended` preset. The
 * community-plugin review scanner goes wider than that, so this config turns on
 * every rule the plugin ships, at error severity, across the whole repo — not
 * just src/, and including the rules that only fire on manifest.json and the
 * locale JSON.
 *
 * It is a diagnostic, not a gate: it is intentionally noisy. Run it with
 *   npm run lint:obsidian
 * and read the per-rule summary to see what the scanner's toolchain can see.
 */
import tsparser from "@typescript-eslint/parser";
import jsoncParser from "jsonc-eslint-parser";
import path from "path";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

const rootDir = path.resolve(import.meta.dirname, "..");

const allObsidianRules = Object.fromEntries(
  Object.keys(obsidianmd.rules).map((name) => [`obsidianmd/${name}`, "error"]),
);

// Rules that only make sense against JSON payloads.
const jsonRules = {
  "obsidianmd/validate-manifest": "error",
  "obsidianmd/validate-license": "error",
  "obsidianmd/ui/sentence-case-json": "error",
};

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "plugin/**",
      "node_modules/**",
      "scripts/**",
      "tooling/**",
      "release/**",
      "offline/**",
      "coverage/**",
      "site/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
      "meta.json",
      "package-lock.json",
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
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: path.join(rootDir, "tsconfig.lint.json"),
        tsconfigRootDir: rootDir,
      },
    },
    rules: allObsidianRules,
  },
  {
    // validate-manifest inspects the ESTree shape (Program > ExpressionStatement >
    // ObjectExpression), which plain JSON parsers do not produce — jsonc-eslint-parser
    // reports a false "must be a single JSON object". This mirrors the configuration
    // the plugin uses for its own RuleTester.
    files: ["manifest.json", "dist/manifest.json"],
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        extraFileExtensions: [".json"],
      },
    },
    rules: { "obsidianmd/validate-manifest": "error" },
  },
  {
    ignores: ["manifest.json", "dist/manifest.json"],
    files: ["**/*.json"],
    plugins: { obsidianmd },
    languageOptions: { parser: jsoncParser },
    rules: jsonRules,
  },
]);
