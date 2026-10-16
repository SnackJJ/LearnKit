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
 * the artefacts back, so every LearnKit surface reads `--learnkit-blur` first (switched to `none`
 * under `body.is-translucent`), then the host token, then the old radius as a last-resort
 * `var()` fallback for hosts that predate the tokens.
 */

import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const STYLES_DIR = path.join(__dirname, "..", "src", "platform", "styles");
const DIST_STYLES = path.join(__dirname, "..", "dist", "styles.css");

const BLUR_TOKEN_RE = /^var\(\s*--learnkit-blur\s*,\s*var\(\s*--blur-(?:s|m|l)\s*,/;

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
    expect(css).toContain("backdrop-filter: var(--learnkit-blur, var(--blur-m, blur(14px)))");
  });

  it("neutralises LearnKit blur in a translucent window through its own token", () => {
    const css = fs.readFileSync(path.join(STYLES_DIR, "layout.css"), "utf8");

    // The switch is a custom property on body, so it reaches every LearnKit surface
    // including the portalled .lk-modals / .learnkit-popover-overlay trees, and it
    // needs no !important: themes control --blur-s/m/l, LearnKit controls this one.
    expect(css).toMatch(/body\.is-translucent \.learnkit[\s\S]{0,900}--learnkit-blur: none;/);
    expect(css).not.toContain("backdrop-filter: none !important");
  });

  it("ships the translucent-window switch, scoped, in the built stylesheet", () => {
    if (!fs.existsSync(DIST_STYLES)) return;

    const css = fs.readFileSync(DIST_STYLES, "utf8");
    // The build scopes/drops bare page-level rules; if this selector were rewritten to
    // `.learnkit` the switch would apply unconditionally and blur would never work.
    expect(css).toContain("body.is-translucent .learnkit");
    expect(css).toMatch(/body\.is-translucent[^{}]{0,200}\{[^{}]*--learnkit-blur:none/);
    // and it must not appear as an unconditional rule on the root
    expect(css).not.toMatch(/\.learnkit\{--learnkit-blur:none\}/);
  });

  it("declares no !important anywhere in the stylesheets", () => {
    const offenders: string[] = [];
    for (const name of fs.readdirSync(STYLES_DIR)) {
      if (!name.endsWith(".css")) continue;
      fs.readFileSync(path.join(STYLES_DIR, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes("!important")) offenders.push(`${name}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
