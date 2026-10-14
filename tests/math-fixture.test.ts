import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseCardsFromText } from "../src/engine/parser/parser";

describe("math-review-test.md fixture", () => {
  // Lives under tests/fixtures so it is versioned with the test: the `offline/`
  // directory is gitignored scratch space and is absent on CI.
  const text = readFileSync(
    new URL("./fixtures/math-review-test.md", import.meta.url),
    "utf8",
  );

  it("parses without errors", () => {
    const { cards } = parseCardsFromText("math-review-test.md", text);
    for (const c of cards) {
      expect(c.errors, `card ${c.id} errors`).toEqual([]);
    }
  });

  it("parses all 21 cards", () => {
    const { cards } = parseCardsFromText("math-review-test.md", text);
    expect(cards.length).toBe(21);
  });

  it("does not truncate the norm-bar display card", () => {
    const { cards } = parseCardsFromText("math-review-test.md", text);
    const norm = cards.find((c) => c.id === "900000008");
    expect(norm).toBeDefined();
    expect(norm!.q).toContain("\\left| x \\right|");
    expect(norm!.q).toContain("where $x$ is a vector.");
  });

  it("does not truncate the matrix card", () => {
    const { cards } = parseCardsFromText("math-review-test.md", text);
    const mat = cards.find((c) => c.id === "900000006");
    expect(mat).toBeDefined();
    expect(mat!.q).toContain("\\begin{bmatrix}");
    expect(mat!.q).toContain("\\end{bmatrix}");
    expect(mat!.q).toContain("1 & 2");
  });
});
