# Changelog

All notable changes to LearnKit are summarized here.

## 1.8.4 (2026-10-15)

### Fixed
- **Rendering artefacts in translucent windows (Baseline theme).** LearnKit's surfaces hardcoded `backdrop-filter: blur(…)` in 34 places (header, dropdowns, modals, session, settings, widget, note-review, exam generator, analytics, study assistant). In a macOS vibrancy window (`body.is-translucent`) a `backdrop-filter` makes Chromium keep and re-sample a backdrop root that contains the window's own vibrancy layer, so every repaint anywhere in the window forces those surfaces to re-rasterise — and the re-sampled region is not clipped to the element, which paints a stale window snapshot outside it. What users saw: the file-explorer sidebar flashing while the pointer moved over it, and a background appearing to bleed out of the LearnKit leaf — up above the tab bar and left to the edge of the nav buttons. Every surface now reads the host theme's `--blur-s/m/l` tokens (with the old radius only as a `var()` fallback), and a `body.is-translucent` guard disables `backdrop-filter` inside LearnKit outright. Themes already make exactly this call — Baseline's `.is-translucent` sets `--blur-s/m/l: none` — and LearnKit was overriding it. Internal note: `--blur-*` are Obsidian's own tokens; never hardcode a blur radius (#217).
- **LearnKit no longer restyles the rest of Obsidian.** An Obsidian plugin's `styles.css` is injected into the running app, so a selector in it applies to the whole window — including the file explorer. Basecoat's preflight had been escaping the `.learnkit` prefix, which shipped page-level rules into every vault: `html { scroll-behavior: smooth }`, `body { overscroll-behavior: none; background-color: …; -webkit-font-smoothing: antialiased }`, `body { --radius-m: … }` (Obsidian's own radius token) and a `:root` block overriding `--scrollbar-width` / `--scrollbar-radius`. All of it is now scoped to LearnKit's own roots; only the private `--lk-*` namespace stays where it was (it cannot collide).
- **Default zoom no longer instantiates a CSS `zoom` context.** `zoom: 1` still spins up a scaling layer in Chromium, and a zoomed subtree next to the translucent sidebar is a known source of repaint/ghost artefacts. The `zoom` declarations now fall back to `zoom: normal` at 1× and only a real pinch-zoom value is written, so nothing is scaled unless the user actually zooms.
- **The button-tooltip observer only touches LearnKit's own DOM.** `initButtonTooltipDefaults` was observing `<body>` and relabelling buttons across the entire app — writing `aria-label`, `data-tooltip`, `data-tooltip-position` and removing `title`. Obsidian's own tooltip system is driven by exactly those attributes (a delegated `pointerover` handler shows a tooltip for any `[aria-label]` element, and the tooltip element is destroyed and rebuilt whenever the anchor changes), so writing them into Obsidian's and other plugins' DOM fought the file explorer's hover tooltip. It is now limited to `.learnkit` / `.lk-modals`.
- **Portalled header popovers no longer leave a wrapper on `<body>`.** Closing the page-switcher or the "more" menu removed the panel but left its empty body-level `.learnkit` wrapper behind (`_sweepOrphanedBodyPortals` exists precisely because of that class of leftover). Both wrappers are now detached on close.

## 1.8.3 (2026-10-14)

### Added
- **Clean up orphaned flashcards** command (command palette): finds flashcards whose source note no longer exists, lists the affected notes, and removes them on confirmation — together with their scheduling state and cached audio (#216).

### Fixed
- **Space and → now reveal the answer and advance**, exactly as the keyboard shortcuts dialog has always claimed. Previously only Enter worked (#215, #208).
- Space still activates whichever control has keyboard focus (grade buttons, MCQ options, Skip), so tabbing and answering by keyboard keeps working.
- **T now switches to the full study page** from the reviewer, matching the documented shortcut and the sidebar widget (#208).
- The **"N due cards remaining"** counter in the study header now updates after every card instead of freezing on the value captured when the session started (#212).
- **AI streaming** no longer fails with `SyntaxError: Unexpected token 'd', "data: {" is not valid JSON {…}`. The streaming transport read a lazily-parsed JSON value from a Server-Sent-Events body; it now reads the text first and parses defensively (#214).
- **Renaming or moving a note (or folder) now re-points its flashcards** in the database. Previously the records kept the old path, the sync engine could no longer match them, and every card deleted afterwards lingered in the Library as a "ghost" — still listed, still impossible to remove through sync (#216).
- **Guide sections no longer become unclickable after a plugin update.** Obsidian does not close a plugin's views when it unloads, so the old view objects — and a Guide dropdown portal left on the page — survived an update and swallowed clicks until Obsidian was restarted (#205).

### Changed
- Open LearnKit tabs are now closed when the plugin is unloaded or updated, so they always rebuild against the new version. The sidebar study widget is reopened automatically if it was open.

## 1.8.2 (2026-09-14)

### Added
- Saved-test editor: rename tests, edit questions, options, and answer keys, and add/remove questions and options (#211).
- Test results now show submitted answers alongside correct answers with explanations (#210).

### Changed
- Test grading: 90%+ is correct, 50–89% is partly correct, and under 50% is wrong (#210).

### Fixed
- Selected answers now stay visibly highlighted, and focused options show a visible outline for keyboard navigation (#209).

Thanks to [@0b10headedcalf](https://github.com/0b10headedcalf) for #209, #210, and #211.

## 1.8.1 (2026-09-06)

### Fixed
- Math now parses/renders correctly in more cases: LaTeX with angle brackets, `|` inside multi-line display math, and delimiter handling inside math blocks.
- Guide navigation dropdowns now open, position, and dismiss reliably.
- Deck and group lists now sort naturally ("2" before "10").

## 1.8.0 (2026-08-31)

### Fixed
- Plugin load crash on Obsidian 1.13+ (`NotAllowedError` on `adoptedStyleSheets`) — dynamic styles are now injected via `<style>` elements instead of constructed stylesheets.
- Tag- and property-scoped study plans now correctly show their flashcards (previously opened an empty reviewer).
- Math inside cloze answers (e.g. `{{c1::$\frac{a}{b}$}}`) now renders on the answer side instead of showing raw LaTeX.

## 1.7.0 (2026-06-24)

### Added
- Redesigned sync mode picker with dropdown and four modes: Simple (recommended), Full (Normalize), Full (Preserve), Off.
- Simple sync mode: scans only canonical LearnKit syntax, skipping shorthand `::` patterns to avoid plugin conflicts.
- `shorthandMode` parser option (`all` / `anchored-only` / `off`) for controlling shorthand detection.
- Sync privilege choice versioning helpers for upgrade detection.

### Changed
- Sync modal intro now recommends Simple mode as the default for new users.
- Sync mode descriptions rewritten for clarity.
- Session dock layout now adapts responsively at narrow window sizes.

### Fixed
- Math `\\` line breaks inside LaTeX blocks no longer collapsed during markdown rendering.
- Open Question submit button now responds reliably.
- TeX commands (like `\begin`) in card fields no longer mangled on read-back.
- Stale i18n audio keys cleaned from en-gb, en-us, zh-cn locales.
- Hardcoded hint label in parse error modal now routed through translation system.
- Lint: 8 errors fixed (style assignments, innerHTML usage, unnecessary assertion).

## 1.5.3 (2026-05-16)

### Note
This release is a duplicate of 1.5.1, re-submitted for Obsidian Community Plugins approval.
Version 1.5.2 was repealed/reverted due to issues encountered during the approval review process.
There are no functional changes relative to 1.5.1.

## 1.5.1 (2026-05-15)

### Changed
- Updated CSS color literals to full 6-digit hex format for lint and approval consistency.
- Added automated CSS hex normalization in the build pipeline for release artifact compliance.
- Included approval-readiness compatibility tidy-ups for Obsidian Community Plugins review.

### Added
- Added Tests for auto-generating study tests.
- Added Coach workflows for guided study prompts.
- Added Note Review workflows.

### Changed
- Updated colour palette for grading buttons.

<details open>
<summary><strong>Latest release: 1.1.0 (2026-03-10)</strong></summary>

### Release notes

Hotfix release focused on reliability and widget UX improvements after 1.0.7.

#### Added
- Added transfer of active study context/session from the widget into the main LearnKit Study tab
- Refreshed plugin iconography in branding assets

#### Changed
- Updated widget launch behavior to open from command palette instead of auto-opening on app reload
- Updated widget colors for better readability in non-translucent windows

#### Fixed
- Adjusted z-index layering for study buttons and modals to prevent overlap conflicts
- Fixed modal launching behavior for more reliable open/close interactions
- Fixed modal sizing to render consistently across screen sizes
- Improved mobile layout to prevent UI elements from being obstructed
- Fixed zoom interaction conflicts with other plugins

#### Links
<a href="https://github.com/ctrlaltwill/LearnKit/issues" style="display:inline-block;padding:6px 12px;margin-right:8px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">GitHub issues</a>
<a href="https://github.com/ctrlaltwill/LearnKit/wiki" style="display:inline-block;padding:6px 12px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">Documentation wiki</a>
</details>

<details>
<summary><strong>1.0.7 (2026-02-26)</strong></summary>

### Release notes

Hotfix release focused on minor bugs identified after 1.0.5 and 1.0.6.

#### Fixed
- Fixed modal launching behavior for more reliable open/close interactions
- Fixed modal sizing to render consistently across screen sizes
- Improved mobile layout to prevent UI elements from being obstructed
- Fixed zoom interaction conflicts with other plugins

#### Links
<a href="https://github.com/ctrlaltwill/LearnKit/issues" style="display:inline-block;padding:6px 12px;margin-right:8px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">GitHub issues</a>
<a href="https://github.com/ctrlaltwill/LearnKit/wiki" style="display:inline-block;padding:6px 12px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">Documentation wiki</a>
</details>

<details>
<summary><strong>1.0.6 (2026-02-18)</strong></summary>

### Release notes

This release focuses on compatibility updates required for Obsidian Community Plugins linter checks during approval.

#### Changed
- Updated plugin code and metadata for compatibility with Obsidian Community Plugins linter requirements
- Performed targeted compatibility tidy-up to support the approval process

#### Fixed
- Addressed linter-related compatibility findings that could block community plugin approval

#### Note
This is a compatibility and approval-readiness release, with no user-facing feature changes.

#### Links
<a href="https://github.com/ctrlaltwill/LearnKit/issues" style="display:inline-block;padding:6px 12px;margin-right:8px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">GitHub issues</a>
<a href="https://github.com/ctrlaltwill/LearnKit/wiki" style="display:inline-block;padding:6px 12px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">Documentation wiki</a>
</details>

<details>
<summary><strong>1.0.5 (2026-02-18)</strong></summary>

### Release notes

This stable release builds on the features delivered in `1.0.5-beta.1`.

#### Added
- Added new card types: multi-select MCQ and ordered questions for memorising sequences
- Added more card customisation: typed cloze and customisation of image occlusion masks
- Overhauled Reading view with two styles: Flashcards and Clean markdown
- Added a new settings view with more control
- Updated the guide and made it visible directly within Obsidian

#### Fixed
- Limited modal background/overlay to the workspace so tab-switching remains available

#### In development
- Mobile functionality support, building on this release
- Continued bug-fix and stability work
- Reading view improvements and expanded style support
- Codebase tidy-up to improve long-term extensibility

#### Hint
If scheduling or analytics data is lost after an update, restore from a backup.

#### Links
<a href="https://github.com/ctrlaltwill/LearnKit/issues" style="display:inline-block;padding:6px 12px;margin-right:8px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">GitHub issues</a>
<a href="https://github.com/ctrlaltwill/LearnKit/wiki" style="display:inline-block;padding:6px 12px;border:1px solid #1f6feb;border-radius:6px;text-decoration:none;color:#1f6feb;">Documentation wiki</a>
</details>
