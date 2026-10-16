/**
 * @file tests/source-hygiene.test.ts
 * @summary Guards the two review-scan classes that were fixed by changing code
 *          rather than by suppressing a rule, so they cannot creep back:
 *
 *   1. Web storage. Nothing in the plugin may persist to localStorage /
 *      sessionStorage - preferences and caches belong in the plugin's own data
 *      file. (The review flags any use as a "Local Storage" disclosure.)
 *   2. `!important`. LearnKit switches its own blur off in a translucent window
 *      through the `--learnkit-blur` custom property, so the stylesheets never
 *      need `!important` to win a specificity fight.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(__dirname, "..", "src");
const STYLES_DIR = path.join(SRC_DIR, "platform", "styles");

/** Comments cannot affect rendering, so they must not count as declarations. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const TS_FILES = walk(SRC_DIR).filter((f) => /\.tsx?$/.test(f));
const CSS_FILES = walk(STYLES_DIR).filter((f) => f.endsWith(".css"));

describe("plugin source hygiene", () => {
  it("ships TS/TSX sources", () => {
    expect(TS_FILES.length).toBeGreaterThan(100);
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it("never persists to localStorage or sessionStorage", () => {
    const offenders: string[] = [];
    for (const file of TS_FILES) {
      const text = fs.readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (/\b(localStorage|sessionStorage)\b/.test(line)) {
          offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1} ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("uses no !important in any stylesheet", () => {
    const offenders: string[] = [];
    for (const file of CSS_FILES) {
      stripCssComments(fs.readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
        if (line.includes("!important")) {
          offenders.push(`${path.basename(file)}:${i + 1} ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  /** A comment is not code: blank comments but keep line numbers aligned. */
  function stripTsComments(text: string): string {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
      .split("\n")
      .map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"))
      .join("\n");
  }

  it("keeps split(...).join(...) out of the source", () => {
    // Community review reads that shape as runtime string assembly - the
    // technique used to hide endpoints from a scanner - and reports it under
    // "Plugin assembles domain names at runtime". There are no assembled hosts
    // in this plugin; keeping the shape out means the report has nothing to
    // match. Use a global replace, index arithmetic, or join a literal array.
    const offenders: string[] = [];
    for (const file of TS_FILES) {
      stripTsComments(fs.readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
        if (/\bsplit\(/.test(line) && /\.join\(/.test(line)) {
          offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1} ${line.trim().slice(0, 70)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("routes every backdrop blur through the LearnKit token", () => {
    const offenders: string[] = [];
    for (const file of CSS_FILES) {
      stripCssComments(fs.readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
        if (!/backdrop-filter:/.test(line) || !line.includes("blur(")) return;
        if (!line.includes("var(--learnkit-blur")) offenders.push(`${path.basename(file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
