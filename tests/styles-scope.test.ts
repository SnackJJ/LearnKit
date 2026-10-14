/**
 * LearnKit ships `styles.css` into the running app, so every selector in it applies to the
 * WHOLE window - every pane, popover and modal, including Obsidian's own file explorer.
 *
 * Basecoat's preflight used to escape the `.learnkit` prefix because the prefixer left
 * `html`, `body` and `:root` alone. That shipped page-level declarations into every vault:
 * `html { scroll-behavior: smooth }`, `body { overscroll-behavior: none }`,
 * `body { --radius-m: ... }` (Obsidian's own radius token) and a `:root` block overriding
 * `--scrollbar-width` / `--scrollbar-radius`.
 *
 * Only `--lk-*` (LearnKit's private namespace) may be declared outside LearnKit's own roots.
 */

import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const scopeGlobalRoots = require("../tooling/postcss-scope-global-roots.cjs");

const GLOBAL_ROOT_RE = /^(?:html|body|:root)$/i;
const GLOBAL_ROOT_WITH_CLASS_RE = /^(?:html|body)\.\S+$/i;

const run = async (css: string) =>
  (
    await postcss([scopeGlobalRoots({ scope: ".learnkit" })]).process(css, { from: undefined })
  ).css;

describe("postcss-scope-global-roots", () => {
  it("drops a bare html preflight rule", async () => {
    const out = await run("html{scroll-behavior:smooth}");
    expect(out).not.toContain("html{");
    expect(out).not.toContain("scroll-behavior");
  });

  it("keeps scoped selectors in a mixed list but strips the global arm", async () => {
    const out = await run(":root,.learnkit :host{--color-background:oklch(100% 0 0);background:#fff}");

    // The point of the rule: the bare `:root` arm must not survive, so nothing declared here
    // reaches the rest of the app. The remaining arms are all scoped to `.learnkit`.
    expect(out).not.toMatch(/(^|[,{}]):root\{/);
    expect(out).not.toMatch(/(^|[,{}]):root,/);

    const root = postcss.parse(out);
    const unscoped: string[] = [];
    root.walkRules((rule) => {
      for (const arm of rule.selectors || []) {
        const trimmed = arm.trim();
        if (GLOBAL_ROOT_RE.test(trimmed) || GLOBAL_ROOT_WITH_CLASS_RE.test(trimmed)) {
          unscoped.push(trimmed);
        }
      }
    });
    expect(unscoped).toEqual([]);

    expect(out).toContain("--color-background:oklch(100% 0 0)");
  });

  it("re-homes custom-property definitions onto LearnKit's own root", async () => {
    const out = await run("body{--color-background:oklch(100% 0 0);--radius:.625rem}");
    expect(out).not.toMatch(/(^|[,{}])body\{/);
    expect(out).toContain(".learnkit{");
    expect(out).toContain("--color-background:oklch(100% 0 0)");
  });

  it("drops preflight declarations instead of re-homing them", async () => {
    // Re-homing `background-color: var(--color-background)` would paint `.learnkit` opaque
    // over a translucent window.
    const out = await run(
      "body{overscroll-behavior:none;background-color:var(--color-background);-webkit-font-smoothing:antialiased}",
    );
    expect(out).not.toContain("overscroll-behavior");
    expect(out).not.toContain("background-color");
    expect(out).not.toContain("font-smoothing");
  });

  it("keeps LearnKit's namespaced custom properties where they are", async () => {
    const out = await run(":root{--lk-radius-lg:16px;--radius:.625rem;--scrollbar-width:6px}");
    expect(out).toContain(":root{--lk-radius-lg:16px}");
    expect(out).toContain(".learnkit{");
    expect(out).not.toMatch(/:root\{[^}]*--scrollbar-width/);
  });

  it("leaves mobile --lk-* overrides alone and scoped rules untouched", async () => {
    const out = await run("body.is-phone{--lk-shell-padding-mobile:8px}.learnkit .x{color:red}");
    expect(out).toContain("body.is-phone{--lk-shell-padding-mobile:8px}");
    expect(out).toContain(".learnkit .x{color:red}");
  });

  it("keeps the built stylesheet free of app-wide rules", () => {
    const distStyles = path.join(__dirname, "..", "dist", "styles.css");
    if (!fs.existsSync(distStyles)) return;

    const root = postcss.parse(fs.readFileSync(distStyles, "utf8"));
    const offenders: string[] = [];

    root.walkRules((rule) => {
      let parent = rule.parent;
      while (parent) {
        if (parent.type === "atrule" && /keyframes/i.test(parent.name)) return;
        parent = parent.parent;
      }

      const globalSelectors = (rule.selectors || []).filter(
        (selector) =>
          GLOBAL_ROOT_RE.test(selector.trim()) || GLOBAL_ROOT_WITH_CLASS_RE.test(selector.trim()),
      );
      if (globalSelectors.length === 0) return;

      // Namespaced custom properties are the only declarations allowed outside our roots.
      const foreign: string[] = [];
      rule.walkDecls((decl) => {
        if (!(decl.prop || "").startsWith("--lk-")) foreign.push(decl.prop);
      });

      if (foreign.length > 0) offenders.push(`${rule.selector} { ${foreign.join(", ")} }`);
    });

    expect(offenders).toEqual([]);
  });
});
