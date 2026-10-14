/**
 * @file tooling/postcss-scope-global-roots.cjs
 * @summary Scopes Basecoat/shadcn global roots out of the shipped plugin stylesheet.
 *
 * An Obsidian plugin's `styles.css` is injected into the app, so it applies to the WHOLE
 * window - every pane, popover, modal and the file explorer - not only to LearnKit's own
 * views. Basecoat's preflight contributes `html`, `body` and `:root` rules, and the prefixer
 * deliberately left those alone ("Leave global roots alone"), so LearnKit shipped page-level
 * declarations into every vault:
 *
 *   html { scroll-behavior: smooth }                    <- changes app-wide scrolling
 *   body { overscroll-behavior: none; background-color: var(--color-background);
 *          color: var(--color-foreground); -webkit-font-smoothing: antialiased }
 *   body { --radius-m: var(--lk-radius-lg) }            <- Obsidian's own radius token
 *   :root { --scrollbar-width: 6px; --radius; --background; --card; --popover; ... }
 *
 * Two different kinds of declaration need two different treatments:
 *
 *   - Custom property *definitions* (`--color-background`, `--radius`, `--lk-*`) are inert
 *     until something reads them, and LearnKit's own scoped rules do read them, so they are
 *     re-homed onto `.learnkit` (except the private `--lk-*` namespace, which stays put and
 *     cannot collide).
 *   - Real declarations (`background-color`, `scroll-behavior`, `overscroll-behavior`,
 *     `-webkit-font-smoothing`, …) are preflight assumptions about the *document*. They are
 *     dropped: re-homing them would paint LearnKit's own roots opaque
 *     (`background-color: var(--color-background)`) over a translucent window.
 */

const GLOBAL_ROOT_RE = /^(?:html|body|:root)$/i;
const GLOBAL_ROOT_WITH_CLASS_RE = /^(?:html|body)\.\S+$/i;
const LK_NAMESPACE_RE = /^--lk-/;

const isGlobalRootSelector = (selector) => {
  const trimmed = (selector || "").trim();
  return GLOBAL_ROOT_RE.test(trimmed) || GLOBAL_ROOT_WITH_CLASS_RE.test(trimmed);
};

/**
 * @param {{ scope?: string, report?: (info: { rule: unknown, dropped: string[] }) => void }} [opts]
 */
module.exports = (opts = {}) => {
  const scopeSelector = opts.scope || ".learnkit";

  return {
    postcssPlugin: "postcss-scope-global-roots",

    Rule(rule) {
      if (!Array.isArray(rule.selectors) || rule.selectors.length === 0) return;

      const globalSelectors = rule.selectors.filter(isGlobalRootSelector);
      if (globalSelectors.length === 0) return;

      const kept = [];
      const moved = [];
      const dropped = [];

      rule.each((node) => {
        if (node.type !== "decl") return;
        const prop = node.prop || "";
        if (LK_NAMESPACE_RE.test(prop)) {
          kept.push(node.clone());
          return;
        }
        if (prop.startsWith("--")) moved.push(node.clone());
        else dropped.push(prop);
      });

      if (dropped.length > 0 && typeof opts.report === "function") {
        opts.report({ rule: rule.selector, dropped });
      }

      // `html` is pure page-level preflight (`scroll-behavior`, `overscroll-behavior`…) and
      // nothing LearnKit renders needs to restyle the document element.
      const htmlOnly = rule.selectors.every((selector) => /^html(?:\.\S+)?$/i.test(selector.trim()));
      if (htmlOnly) {
        rule.removeAll();
        kept.forEach((decl) => rule.append(decl));
        if (rule.nodes.length === 0) rule.remove();
        return;
      }

      // Tailwind emits selector lists such as `:root, :host { --color-…; --text-… }` (the build
      // prefixes `:host` to `.learnkit :host`). Those variables feed LearnKit's scoped rules, so
      // they have to stay reachable from `.learnkit` - but the bare `:root` arm must not reach
      // the rest of the app.
      const scopedSelectors = rule.selectors.filter((selector) => !isGlobalRootSelector(selector));

      if (scopedSelectors.length > 0) {
        if (moved.length > 0) {
          const scoped = rule.cloneAfter({ selector: scopeSelector });
          scoped.removeAll();
          moved.forEach((decl) => scoped.append(decl));
        }
        rule.selectors = scopedSelectors;
        return;
      }

      if (moved.length > 0) {
        const scoped = rule.cloneAfter({ selector: scopeSelector });
        scoped.removeAll();
        moved.forEach((decl) => scoped.append(decl));
      }

      if (kept.length === 0) {
        rule.remove();
        return;
      }

      rule.removeAll();
      kept.forEach((decl) => rule.append(decl));
    },
  };
};

module.exports.postcss = true;
