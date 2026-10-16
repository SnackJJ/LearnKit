/**
 * @vitest-environment jsdom
 * @file tests/legacy-sprout-compat.test.ts
 * @summary Guards the parts of the Sprout -> LearnKit rename that must stay
 * backwards compatible with data the old plugin already wrote.
 *
 * Three classes of value were renamed for branding but are load-bearing for
 * existing vaults, because they are matched against data produced by an older
 * version of the plugin rather than regenerated on every render:
 *
 *   1. card anchors in markdown      -> `^sprout-<id>` must still resolve
 *   2. generated IO/HQ image names   -> `sprout-io-<id>.<ext>` must still resolve
 *   3. the plugin data file         -> prefs live in data.json only (no web storage)
 *
 * If one of these tests fails after a rebrand/rename sweep, the sweep has turned
 * a *current* identifier into a *legacy* one instead of accepting both.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  CARD_ANCHOR_INLINE_RE,
  CARD_ANCHOR_LINE_RE,
  CARD_ANCHOR_PREFIX_PATTERN,
  CURRENT_PLUGIN_ID,
  LEGACY_PLUGIN_ID,
  buildPrimaryCardAnchor,
  createCardAnchorGlobalRe,
  extractCardAnchorId,
  getPluginDirCandidates,
  hasCardAnchorForId,
} from "../src/platform/core/identity";
import { collectAnchorIdsFromText } from "../src/platform/image-occlusion/io-helpers";
import { flagCacheWasPersisted } from "../src/platform/flags/flag-tokens";

const LEGACY_FLAG_CACHE_KEY = "sprout-circle-flag-cache-v1";
const LEGACY_DENSITY_KEY = "sprout.browser.tableDensity.v1";
const CURRENT_DENSITY_KEY = "learnkit.browser.tableDensity.v1";

describe("legacy Sprout compatibility", () => {
  describe("card anchors", () => {
    it("extracts an id from a legacy ^sprout- anchor", () => {
      expect(extractCardAnchorId("^sprout-123456789")).toBe("123456789");
    });

    it("extracts an id from a current ^learnkit- anchor", () => {
      expect(extractCardAnchorId("^learnkit-123456789")).toBe("123456789");
    });

    it("matches legacy and current anchors inline", () => {
      expect(CARD_ANCHOR_INLINE_RE.test("^sprout-501802774")).toBe(true);
      expect(CARD_ANCHOR_INLINE_RE.test("^learnkit-501802774")).toBe(true);
    });

    it("still requires a prefixed anchor, not a bare id", () => {
      expect(CARD_ANCHOR_LINE_RE.test("^123456789")).toBe(false);
    });

    it("resolves legacy anchors for a known card id", () => {
      expect(hasCardAnchorForId("^sprout-123456789", "123456789")).toBe(true);
      expect(hasCardAnchorForId("^learnkit-123456789", "123456789")).toBe(true);
      expect(hasCardAnchorForId("^learnkit-999999999", "123456789")).toBe(false);
    });

    it("collects both prefixes from one document in order", () => {
      const text = "^sprout-111111111\nQ | one |\n\n^learnkit-222222222\nQ | two |";
      const found = Array.from(text.matchAll(createCardAnchorGlobalRe()), (m) => m[1]);
      expect(found).toEqual(["111111111", "222222222"]);
    });

    it("only emits the current prefix for new anchors", () => {
      expect(buildPrimaryCardAnchor("123456789")).toBe("^learnkit-123456789");
    });

    it("keeps the pattern in step with the identity constants", () => {
      expect(CARD_ANCHOR_PREFIX_PATTERN).toContain(CURRENT_PLUGIN_ID);
      expect(CARD_ANCHOR_PREFIX_PATTERN).toContain(LEGACY_PLUGIN_ID);
    });
  });

  describe("image-occlusion anchors", () => {
    it("collects legacy and current anchor ids from note text", () => {
      const ids = collectAnchorIdsFromText("^sprout-123456789 and ^learnkit-987654321");
      expect(ids.has("123456789")).toBe(true);
      expect(ids.has("987654321")).toBe(true);
    });
  });

  describe("plugin directory candidates", () => {
    it("offers the pre-rebrand plugin folder when migrating data", () => {
      const dirs = getPluginDirCandidates(".obsidian", "learnkit");
      expect(dirs).toContain(".obsidian/plugins/learnkit");
      expect(dirs).toContain(".obsidian/plugins/sprout");
    });
  });
});
