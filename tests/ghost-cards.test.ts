/**
 * @file tests/ghost-cards.test.ts
 * @summary Regression tests for GitHub #216 — orphaned/ghost flashcards.
 *
 * Two failure modes are covered:
 *  1. A note (or folder) is renamed/moved and the card records keep the old
 *     `sourceNotePath`, so the sync engine can never reconcile them again.
 *  2. A record whose note no longer exists at all: nothing removes it, so it shows up
 *     in the Library and in study sessions forever.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TFile } from "obsidian";

import { JsonStore } from "../src/platform/core/store";
import { findOrphanedCards, pruneOrphanedCards } from "../src/platform/integrations/sync/sync-engine";
import type { CardRecord } from "../src/platform/types/card";

class MemoryVault {
  files = new Map<string, TFile>();
  configDir = ".obsidian";
  adapter: unknown = null;

  getAbstractFileByPath(path: string): TFile | null {
    return this.files.get(path) ?? null;
  }

  getMarkdownFiles(): TFile[] {
    return Array.from(this.files.values()).filter((f) => f.path.endsWith(".md"));
  }

  add(path: string): TFile {
    const file = new TFile();
    file.path = path;
    file.name = path.split("/").pop() ?? "";
    file.basename = file.name.replace(/\.md$/i, "");
    file.extension = "md";
    this.files.set(path, file);
    return file;
  }
}

function makePlugin(vault: MemoryVault) {
  const plugin: any = {
    app: { vault, fileManager: { trashFile: vi.fn(async () => {}) }, metadataCache: {} },
    manifest: { id: "" },
    settings: { indexing: { ignoreInCodeFences: false }, storage: { deleteOrphanedImages: false } },
    saveAll: vi.fn(async () => {}),
    loadData: vi.fn(async () => ({})),
  };
  plugin.store = new JsonStore(plugin);
  return plugin;
}

function card(overrides: Partial<CardRecord> & { id: string; sourceNotePath: string }): CardRecord {
  return {
    type: "basic",
    title: null,
    q: "Q",
    a: "A",
    sourceStartLine: 1,
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  } as CardRecord;
}

describe("JsonStore.retargetSourceNotePath", () => {
  it("retargets cards when a single note is renamed", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      a: card({ id: "a", sourceNotePath: "Bio/cells.md" }),
      b: card({ id: "b", sourceNotePath: "Chem/atoms.md" }),
    };

    const moved = plugin.store.retargetSourceNotePath("Bio/cells.md", "Biology/cells.md");

    expect(moved).toBe(1);
    expect(plugin.store.data.cards.a.sourceNotePath).toBe("Biology/cells.md");
    expect(plugin.store.data.cards.b.sourceNotePath).toBe("Chem/atoms.md");
  });

  it("retargets every note inside a moved folder", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      a: card({ id: "a", sourceNotePath: "Bio/cells.md" }),
      b: card({ id: "b", sourceNotePath: "Bio/deep/mitosis.md" }),
      c: card({ id: "c", sourceNotePath: "Bioother/nope.md" }),
    };

    const moved = plugin.store.retargetSourceNotePath("Bio", "Modules/Bio");

    expect(moved).toBe(2);
    expect(plugin.store.data.cards.a.sourceNotePath).toBe("Modules/Bio/cells.md");
    expect(plugin.store.data.cards.b.sourceNotePath).toBe("Modules/Bio/deep/mitosis.md");
    // Prefix match must not bleed into a sibling folder with the same start.
    expect(plugin.store.data.cards.c.sourceNotePath).toBe("Bioother/nope.md");
  });

  it("follows capitalisation-only renames (macOS case-insensitive filesystems)", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { a: card({ id: "a", sourceNotePath: "bio/cells.md" }) };

    expect(plugin.store.retargetSourceNotePath("bio/cells.md", "Bio/Cells.md")).toBe(1);
    expect(plugin.store.data.cards.a.sourceNotePath).toBe("Bio/Cells.md");
  });

  it("retargets quarantined entries too", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.quarantine = {
      q1: { id: "q1", notePath: "Bio/cells.md", sourceStartLine: 1, reason: "x", lastSeenAt: 1 },
    } as any;

    plugin.store.retargetSourceNotePath("Bio/cells.md", "Biology/cells.md");

    expect(plugin.store.data.quarantine.q1.notePath).toBe("Biology/cells.md");
  });

  it("is a no-op for unrelated paths and identical paths", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { a: card({ id: "a", sourceNotePath: "Bio/cells.md" }) };

    expect(plugin.store.retargetSourceNotePath("Other/thing.md", "Elsewhere/thing.md")).toBe(0);
    expect(plugin.store.retargetSourceNotePath("Bio/cells.md", "Bio/cells.md")).toBe(0);
    expect(plugin.store.retargetSourceNotePath("", "Bio/cells.md")).toBe(0);
    expect(plugin.store.data.cards.a.sourceNotePath).toBe("Bio/cells.md");
  });
});

describe("findOrphanedCards", () => {
  it("reports cards whose note is gone and ignores cards whose note exists", () => {
    const vault = new MemoryVault();
    vault.add("Bio/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      live: card({ id: "live", sourceNotePath: "Bio/cells.md" }),
      ghost: card({ id: "ghost", sourceNotePath: "Bio/deleted.md" }),
      drifted: card({ id: "drifted", sourceNotePath: "Old/path.md" }),
    };

    const orphans = findOrphanedCards(plugin).map((o) => o.id).sort();

    expect(orphans).toEqual(["drifted", "ghost"]);
  });

  it("does not report child cards (they are reaped through their parent)", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      parent: card({ id: "parent", sourceNotePath: "Missing/parent.md" }),
      child: card({ id: "child", type: "cloze-child", sourceNotePath: "Missing/parent.md" }),
    };

    const orphans = findOrphanedCards(plugin);

    expect(orphans.map((o) => o.id)).toEqual(["parent"]);
  });

  it("ignores records with an empty path (nothing to attribute them to)", () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { pathless: card({ id: "pathless", sourceNotePath: "" }) };

    expect(findOrphanedCards(plugin)).toEqual([]);
  });
});

describe("pruneOrphanedCards", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("removes ghost cards, their states and their children", async () => {
    const vault = new MemoryVault();
    vault.add("Bio/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      live: card({ id: "live", sourceNotePath: "Bio/cells.md" }),
      ghost: card({ id: "ghost", sourceNotePath: "Bio/gone.md" }),
      child: card({ id: "child", type: "cloze-child", sourceNotePath: "Bio/gone.md" }),
    };
    plugin.store.data.states = {
      live: { id: "live", stage: "review" },
      ghost: { id: "ghost", stage: "review" },
      child: { id: "child", stage: "review" },
    } as any;

    const result = await pruneOrphanedCards(plugin);

    expect(result.removed).toBe(1);
    expect(result.ids).toEqual(["ghost"]);
    expect(Object.keys(plugin.store.data.cards).sort()).toEqual(["live"]);
    expect(Object.keys(plugin.store.data.states)).toEqual(["live"]);
    expect(result.skippedReason).toBeUndefined();
  });

  it("removes orphaned scheduling states left behind", async () => {
    const vault = new MemoryVault();
    vault.add("Bio/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { ghost: card({ id: "ghost", sourceNotePath: "Bio/gone.md" }) };
    plugin.store.data.states = {
      ghost: { id: "ghost", stage: "review" },
      dangling: { id: "dangling", stage: "new" },
    } as any;

    await pruneOrphanedCards(plugin);

    expect(plugin.store.data.states).toEqual({});
  });

  it("dry run reports the ghosts without deleting anything", async () => {
    const vault = new MemoryVault();
    vault.add("Bio/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { ghost: card({ id: "ghost", sourceNotePath: "Bio/gone.md" }) };

    const result = await pruneOrphanedCards(plugin, { dryRun: true });

    expect(result.removed).toBe(1);
    expect(plugin.store.data.cards.ghost).toBeDefined();
  });

  it("refuses to run when the vault reports no markdown files", async () => {
    const vault = new MemoryVault();
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { ghost: card({ id: "ghost", sourceNotePath: "Bio/gone.md" }) };

    const result = await pruneOrphanedCards(plugin);

    expect(result.skippedReason).toBe("vault-empty");
    expect(result.removed).toBe(0);
    // The card must survive: the index simply is not ready yet.
    expect(plugin.store.data.cards.ghost).toBeDefined();
  });

  it("is a no-op when every note still exists", async () => {
    const vault = new MemoryVault();
    vault.add("Bio/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = { live: card({ id: "live", sourceNotePath: "Bio/cells.md" }) };

    const result = await pruneOrphanedCards(plugin);

    expect(result.removed).toBe(0);
    expect(plugin.store.data.cards.live).toBeDefined();
  });
});

describe("rename → delete → cleanup end to end", () => {
  it("keeps cards reconcilable after a rename so cleanup can finish the job", async () => {
    const vault = new MemoryVault();
    vault.add("Notebook/cells.md");
    const plugin = makePlugin(vault);
    plugin.store.data.cards = {
      a: card({ id: "a", sourceNotePath: "Notebook/cells.md" }),
      b: card({ id: "b", sourceNotePath: "Notebook/cells.md" }),
    };

    // 1. The note is renamed — records must follow it.
    plugin.store.retargetSourceNotePath("Notebook/cells.md", "Study/Bio/cells.md");
    expect(plugin.store.data.cards.a.sourceNotePath).toBe("Study/Bio/cells.md");

    // 2. The note is deleted from the vault entirely.
    vault.files.delete("Study/Bio/cells.md");

    // 3. Cleanup removes both ghosts.
    expect(findOrphanedCards(plugin).map((o) => o.id).sort()).toEqual(["a", "b"]);
    const result = await pruneOrphanedCards(plugin);
    expect(result.removed).toBe(2);
    expect(Object.keys(plugin.store.data.cards)).toEqual([]);
  });
});
