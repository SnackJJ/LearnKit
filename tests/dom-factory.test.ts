/**
 * @vitest-environment jsdom
 * @file tests/dom-factory.test.ts
 * @summary Contract for the detached-element factory that replaced 1,100
 *          `createElement` call sites.
 *
 * The whole point of the refactor was that `makeEl(tag, doc)` behaves exactly
 * like `doc.createElement(tag)`: it must return a DETACHED element belonging to
 * the document you asked for. Obsidian's `createEl` family cannot be used here
 * because `Node.prototype.createEl` forces `{ parent: this }` and therefore
 * APPENDS (so `activeDocument.createEl("div")` is `document.appendChild(div)`,
 * which throws), and the global `createEl()` always uses the main window.
 *
 * These tests pin the two properties that make the factory safe, plus the
 * pop-out case: the document must be resolved per CALL, not captured at import.
 */

import { describe, it, expect } from "vitest";
import { makeEl, makeSvgEl } from "../src/platform/core/dom-factory";

describe("dom-factory", () => {
  it("returns a detached element, not an appended one", () => {
    const before = document.body.childElementCount;
    const el = makeEl("div");

    expect(el.tagName).toBe("DIV");
    expect(el.parentNode).toBeNull();
    expect(el.isConnected).toBe(false);
    // The failure mode we are guarding against: appending to the document.
    expect(document.body.childElementCount).toBe(before);
  });

  it("creates in the document passed in, not the active one", () => {
    const other = document.implementation.createHTMLDocument("popout");
    const el = makeEl("section", other as unknown as Document) as HTMLElement;

    expect(el.ownerDocument).toBe(other);
    expect(el.ownerDocument).not.toBe(document);
    expect(el.tagName).toBe("SECTION");
  });

  it("resolves activeDocument per call, so pop-out windows work", () => {
    const other = document.implementation.createHTMLDocument("popout");
    const original = globalThis.activeDocument;

    try {
      const inMain = makeEl("div");
      expect(inMain.ownerDocument).toBe(document);

      // Simulate Obsidian switching the active document when a pop-out gains focus.
      globalThis.activeDocument = other as unknown as Document;
      const inPopout = makeEl("div");
      expect(inPopout.ownerDocument).toBe(other);
      expect(inPopout.ownerDocument).not.toBe(document);
    } finally {
      globalThis.activeDocument = original;
    }
  });

  it("creates SVG elements in the SVG namespace", () => {
    const svg = makeSvgEl("svg");
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.tagName.toLowerCase()).toBe("svg");

    const path = makeSvgEl("path");
    expect(path.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(path.parentNode).toBeNull();
  });

  it("accepts a runtime tag name and still returns a detached element", () => {
    const tagName: string = "p";
    const el = makeEl(tagName);
    expect(el.tagName).toBe("P");
    expect(el.parentNode).toBeNull();
  });

  it("narrows the return type for literal tags", () => {
    // Type-level assertion: compiles only if the overload picks HTMLInputElement.
    const input: HTMLInputElement = makeEl("input");
    input.type = "checkbox";
    expect(input.type).toBe("checkbox");
  });
});
