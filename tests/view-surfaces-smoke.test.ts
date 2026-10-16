/**
 * @vitest-environment jsdom
 * @file tests/view-surfaces-smoke.test.ts
 * @summary Loads every view/UI module so a broken import or a module-level
 *          throw cannot ship unnoticed.
 *
 * A 1,100-site codemod touched ~54 files across card browser, reviewer, image
 * occlusion, analytics, coach, settings and the widget. Type-checking does not
 * cover this repo (tsc is not part of the build) and unit tests import modules
 * one at a time, so nothing was checking the whole surface at once.
 *
 * This test does not try to render anything - it imports each module and
 * asserts its public entry points exist. That is enough to catch: a bad import
 * path, a syntax-level mistake, a module-level throw, or an export that the
 * refactor accidentally removed.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const VIEWS_DIR = path.join(__dirname, "..", "src", "views");

/** Every .ts/.tsx module under src/views, as an import specifier. */
function collectModules(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectModules(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full.replace(/\.tsx?$/, ""));
    }
  }
  return out;
}

const MODULES = collectModules(VIEWS_DIR).sort();

describe("view surfaces load", () => {
  it("found the expected number of view modules", () => {
    // Guards against the collector silently matching nothing.
    expect(MODULES.length).toBeGreaterThan(30);
  });

  it.each(MODULES.map((m) => [path.relative(VIEWS_DIR, m), m]))(
    "imports %s without throwing",
    async (_label, absolute) => {
      const mod = await import(absolute);
      expect(mod).toBeTypeOf("object");
    },
  );
});

describe("key entry points are still exported", () => {
  // Each of these is a surface the codemod touched. If one of these names goes
  // missing, the view that consumes it silently stops rendering.
  const EXPECTED: Array<[string, string[]]> = [
    ["browser/card-browser-view", ["LearnKitCardBrowserView"]],
    ["analytics/analytics-view", ["LearnKitAnalyticsView"]],
    ["coach/coach-view", ["LearnKitCoachView"]],
    ["settings/settings-view", ["LearnKitSettingsView"]],
    ["reviewer/review-view", ["LearnKitReviewerView"]],
    ["note-review/note-review-view", ["LearnKitNoteReviewView"]],
    ["reading/reading-view", ["renderReadingViewPreviewCard", "syncReadingViewStyles"]],
    ["exam-generator/exam-generator-view", ["LearnKitExamGeneratorView"]],
    ["home/home-view", ["LearnKitHomeView"]],
  ];

  it.each(EXPECTED)("views/%s exports %j", async (rel, names) => {
    const mod = (await import(path.join(VIEWS_DIR, rel))) as Record<string, unknown>;
    for (const name of names) {
      expect(mod[name], `${rel} is missing export ${name}`).toBeDefined();
    }
  });

  it("the analytics charts still export their components", async () => {
    const charts = [
      ["charts/forgetting-curve-chart", "ForgettingCurveChart"],
      ["charts/future-due-chart", "FutureDueChart"],
      ["charts/new-cards-per-day-chart", "NewCardsPerDayChart"],
      ["charts/stability-distribution-chart", "StabilityDistributionChart"],
      ["charts/stacked-review-buttons-chart", "StackedReviewButtonsChart"],
      ["charts/pie-charts", "StagePieCard"],
      ["charts/review-calendar-heatmap", "ReviewCalendarHeatmap"],
      ["charts/chartjs-canvas", "ChartJsCanvas"],
    ] as const;

    for (const [rel, name] of charts) {
      const mod = (await import(path.join(VIEWS_DIR, "analytics", rel))) as Record<string, unknown>;
      expect(mod[name], `analytics/${rel} is missing ${name}`).toBeDefined();
    }
  });

  it("the coach panel charts still export their components", async () => {
    const mod = (await import(path.join(VIEWS_DIR, "coach", "coach-charts"))) as Record<
      string,
      unknown
    >;
    expect(mod.CoachHealthPanel).toBeDefined();
    expect(mod.CoachReadinessPanel).toBeDefined();
  });
});
