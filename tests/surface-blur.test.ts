/**
 * Surface blur must be delegated to the host theme.
 *
 * `backdrop-filter` in a macOS vibrancy window (`body.is-translucent`) makes Chromium keep and
 * re-sample a backdrop root that includes the window's own vibrancy layer. Two visible
 * consequences, both reported against the Baseline theme (LearnKit #217):
 *
 *   1. every repaint anywhere in the window forces already-composited blurred surfaces to
 *      re-rasterise -> the file explorer (and the window) flickers while the pointer moves;
 *   2. the re-sampled region is not clipped to the element, so a stale window snapshot gets
 *      painted outside it -> a background bleeding "above the tabs and out to the left".
 *
 * Obsidian core exposes `--blur-s/m/l` (built from `--blur-radius-s/m/l` + the saturation and
 * brightness tokens) exactly so a theme can switch surface blur off, and Baseline's
 * `.is-translucent` sets them to `none`. Hardcoding a radius overrides that decision and brings
 * the artefacts back, so every LearnKit surface must read the token with the old radius only as
 * a `var()` fallback for hosts that predate the tokens.
 */

import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const STYLES_DIR = path.join(__dirname, "..", "src", "platform", "styles");
const DIST_STYLES = path.join(__dirname, "..", "dist", "styles.css");

const BLUR_TOKEN_RE = /^var\(\s*--blur-(?:s|m|l)\s*,/;

/** Every `backdrop-filter` declaration that blurs, with the value as written. */
function backdropBlurDecls(css: string, label: string): string[] {
  const root = postcss.parse(css);
  const out: string[] = [];

  root.walkDecls((decl) => {
    const prop = (decl.prop || "").toLowerCase();
    if (prop !== "backdrop-filter" && prop !== "-webkit-backdrop-filter") return;
    if (!decl.value.includes("blur(")) return;
    out.push(`${label}: ${decl.value.trim()}`);
  });

  return out;
}

describe("surface blur uses the host theme's tokens", () => {
  it("has no bare blur radius in any source stylesheet", () => {
    const offenders: string[] = [];

    for (const name of fs.readdirSync(STYLES_DIR)) {
      if (!name.endsWith(".css")) continue;
      const css = fs.readFileSync(path.join(STYLES_DIR, name), "utf8");
      for (const value of backdropBlurDecls(css, name)) {
        if (!BLUR_TOKEN_RE.test(value.split(": ").slice(1).join(": "))) offenders.push(value);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the built stylesheet free of bare blur radii", () => {
    if (!fs.existsSync(DIST_STYLES)) return;

    const offenders = backdropBlurDecls(fs.readFileSync(DIST_STYLES, "utf8"), "dist").filter(
      (value) => !BLUR_TOKEN_RE.test(value.split(": ").slice(1).join(": ")),
    );

    expect(offenders).toEqual([]);
  });

  it("still blurs somewhere, so the var() migration did not silently drop the look", () => {
    const css = fs.readFileSync(path.join(STYLES_DIR, "header.css"), "utf8");
    expect(css).toContain("backdrop-filter: var(--blur-m, blur(14px))");
  });

  it("neutralises backdrop-filter inside LearnKit when the window is translucent", () => {
    const css = fs.readFileSync(path.join(STYLES_DIR, "layout.css"), "utf8");

    expect(css).toContain("body.is-translucent .learnkit");
    // `!important` is required: header.css declares a blur on
    // `body:not(.is-phone) .learnkit .view-header.learnkit-header`, which outranks
    // `body.is-translucent .learnkit *`.
    expect(css).toMatch(
      /body\.is-translucent \.learnkit[\s\S]{0,400}backdrop-filter: none !important/,
    );
  });
});
