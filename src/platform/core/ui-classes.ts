/**
 * @file src/platform/core/ui-classes.ts
 * @summary Module for ui classes.
 *
 * @exports
 *  - LEARNKIT_TITLE_TEXT_CLASS
 *  - LEARNKIT_TITLE_STRIP_LABEL_CLASS
 *  - LEARNKIT_HOME_CONTENT_SHELL_CLASS
 */

/* ============================================================================
   Shared UI class tokens for TS renderers.
   Keeps utility-first class usage consistent across views.
   ========================================================================== */

export const LEARNKIT_TITLE_TEXT_CLASS = "text-xl font-semibold tracking-tight";

export const LEARNKIT_TITLE_STRIP_LABEL_CLASS =
  `learnkit-view-title-strip-label ${LEARNKIT_TITLE_TEXT_CLASS}`;

export const LEARNKIT_HOME_CONTENT_SHELL_CLASS =
  "learnkit-view-content-shell lk-home-content-shell";
