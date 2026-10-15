/**
 * @file src/platform/core/dom-factory.ts
 * @summary Detached-element factory — the single place LearnKit creates
 *          elements that are not immediately attached to a parent.
 *
 * @exports
 *  - makeEl     — create a detached HTML element in a given document
 *  - makeSvgEl  — create a detached SVG element in a given document
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (read before "simplifying" it away)
 *
 * Static analysers flag `document.createElement` and suggest Obsidian's
 * `createEl` / `createDiv` / `createSpan` / `createSvg` helpers. Those helpers
 * are NOT interchangeable with `createElement` here, for two independent
 * reasons. Both were confirmed by reading Obsidian's own shipped bundle
 * (Contents/Resources/obsidian.asar):
 *
 *   1. The prototype helpers APPEND. Obsidian defines them as:
 *
 *        Node.prototype.createEl = function (t, e, n) {
 *          "string" == typeof e && (e = { cls: e });
 *          (e = e || {}).parent = this;      // <-- forces the receiver as parent
 *          return createEl(t, e, n);         // <-- and this appends to o.parent
 *        };
 *        Node.prototype.createDiv  = function (t, e) { return this.createEl("div",  t, e); };
 *        Node.prototype.createSpan = function (t, e) { return this.createEl("span", t, e); };
 *        Node.prototype.createSvg  = function (t, e, n) { ...; (e = e || {}).parent = this; ... };
 *
 *      `Document` inherits from `Node`, so `activeDocument.createEl("div")`
 *      would call `document.appendChild(div)` — which throws
 *      `HierarchyRequestError: Only one element on document allowed.` Almost
 *      every element this plugin builds is constructed detached, populated,
 *      and handed to a caller that decides where it goes, so swapping in
 *      `createEl` would break the plugin outright.
 *
 *   2. The global helpers ignore pop-out windows. `window.createEl` (and
 *      `createDiv` / `createSpan` / `createSvg`) are defined against the
 *      *main* window's `document`:
 *
 *        window.createEl = function (t, e, n) { var r = document.createElement(t); ... };
 *
 *      LearnKit renders into pop-out windows, where `activeDocument` and each
 *      node's `ownerDocument` are a different document. Creating into the main
 *      document would put the UI in the wrong window.
 *
 * So a detached element must come from the owning document, which is exactly
 * what this module does. Centralising it means the reasoning above is stated
 * once, and the raw `createElement` calls are confined to this file.
 *
 * Callers: pass the owner document when you have one (pop-out safe); the
 * default is `activeDocument`.
 */

/** Create a detached HTML element in `doc` (defaults to the active document). */
export function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  doc?: Document,
): HTMLElementTagNameMap[K];
/** Fallback for callers holding a runtime tag name rather than a literal. */
export function makeEl(tag: string, doc?: Document): HTMLElement;
export function makeEl(tag: string, doc: Document = activeDocument): HTMLElement {
  return doc.createElement(tag);
}

/** Create a detached SVG element in `doc` (defaults to the active document). */
export function makeSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  doc?: Document,
): SVGElementTagNameMap[K];
/** Fallback for callers holding a runtime tag name rather than a literal. */
export function makeSvgEl(tag: string, doc?: Document): SVGElement;
export function makeSvgEl(tag: string, doc: Document = activeDocument): SVGElement {
  return doc.createElementNS("http://www.w3.org/2000/svg", tag);
}
