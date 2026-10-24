# MarkSI roadmap and milestone control

This document is the planning source of truth for milestone scope, order, and
exit criteria. `docs/features.md` remains the detailed feature inventory.
The public security and version policies are enforced by
`scripts/publication-audit.mjs`.

## Current snapshot

- Product version: **0.31**
- Technical version: **0.31.0**
- Foundation milestones M1 and M3 are complete.
- M2 core is complete; golden Markdown tests remain open.
- M4 is complete.
- M5 is complete with twenty-three done items and one explicitly deferred
  uploader integration.
- M6 has started with system appearance, additional themes, user CSS themes,
  the shortcut editor, Windows installer validation, CLI open, file
  associations, window flags, window and session memory, advanced JSON
  settings, release checksums, and the Windows/Linux build-test matrix; Linux
  packaging is being validated in the release workflow. M7 has not started.
- The latest full gate is green: Vitest, Rust, frontend build, real-WebView
  E2E, and the publication audit.

Feature-count progress is not schedule or effort progress. The detailed table
is the source for exact status values. Current raw count: **104 done, 6 wip,
10 todo, 2 deferred** across 122 items.

## Milestone definitions

### M0 — Foundation and release governance

Scope: project setup, licensing, dependency notices, release/security policy,
versioning, and automated publication checks.

Exit criteria:

- MIT license and third-party notices are present and reviewed.
- Public security audit runs locally before push and in GitHub Actions.
- Version display and one-step release bumping are enforced.
- Full build/test CI matrix exists for Windows and Linux.

Current gap: full cross-platform build/test CI is still open. The current
GitHub Actions workflow runs the publication audit only.

### M1 — Desktop foundation

Scope: Tauri shell, title bar, editor, file open/save, encoding and line-ending
preservation, themes, sidebar, outline, search, recent files, and close
protection.

Status: complete. Any regression is handled as maintenance, not as new scope.

### M2 — Editing, preview, and export

Scope: source/live-preview/reading modes, sanitized Markdown rendering,
formatting, find/replace, print, HTML/PDF export, and Markdown compatibility
tests.

Exit criteria:

- Core editing and mode transitions have E2E coverage.
- Export paths have automated checks where the platform permits.
- Golden Markdown fixtures cover CommonMark/GFM edge cases.
- No known reproducible P0/P1 regression.

Current gap: golden Markdown tests and complete cross-platform export coverage.

### M3 — Workspace and reliability

Scope: preferences, quick open, workspace search, autosave, recovery drafts,
and external-change detection.

Status: complete.

### M4 — Files, history, and workspace operations

Scope: file operations, flat file list, local history, pinned locations,
encoding reopen, and large-file mode.

Exit criteria:

- Filesystem operations have Rust tests for path validation and atomicity.
- The sidebar exposes the operations through keyboard-accessible UI.
- File operations have E2E coverage through the WebView where possible.
- Large-file behavior is measurable and documented.

M4 is closed. All file/workspace debt is done, and M6 release work can begin.

### M5 — Advanced Markdown, images, and export

Scope: strict/lax Markdown, image dimensions and fit, remote image handling,
uploaders, export image, optional Pandoc integration, export profiles, front
matter export options, and page setup.

Exit criteria:

- Every M5 row is `done` or explicitly `deferred` with a documented reason.
- New rendering paths are covered by Vitest and real-WebView E2E.
- Exported output and clipboard output use the same sanitized renderer.
- Remote image/uploader features define explicit network and privacy behavior.
- The full gate is green and the release version is incremented one step.

M5 is complete except for uploader integration, which is deferred until a
separate credentials and third-party network review. The next milestone work is
M6 platform/release engineering.

Remote image and uploader work must not silently enable background network
requests. They require explicit user action, clear cache behavior, and tests
for failure/offline states.

### M6 — Platform and release

Scope: native title bar, multiple windows, session restore, system appearance,
shortcut editor, advanced settings, additional themes, installers, autoupdate,
signed releases, file associations, single instance, CLI open, and full CI.

Entry criteria:

- M4 and M5 exit criteria are closed.
- The full gate is green.
- Native-dialog manual checks are documented.

Status: in progress. System appearance, additional themes, user CSS themes, the
shortcut editor, Windows installer validation, CLI open, file associations,
window flags, window/session memory, and advanced JSON settings are complete.
Release checksums and Linux packaging are being validated in the release
workflow; the remaining M6 scope is still open.

### M7 — Performance, accessibility, and internationalization depth

Scope: IME/CJK coverage, large-document performance, RTL/accessibility pass, and
Flatpak packaging.

Status: not started.

## Delivery rules

Every change follows this order:

1. Reproduce the bug or define the feature acceptance check.
2. Add unit tests for pure logic and Rust tests for filesystem behavior.
3. Add an E2E check for every touched user-visible flow.
4. Run the complete gate.
5. Update `docs/features.md`, this roadmap if scope changes, and
   `docs/verification.md` when coverage or limitations change.
6. For a user-visible feature or bugfix release, run
   `npm run version:bump` exactly once. Never skip a version step.
7. Reset the running app to a clean state and verify the protected user
   document is unchanged.
8. Push; the pre-push hook and GitHub Actions publication audit must pass.

Documentation-only planning corrections do not require a version bump. A
feature or bugfix release does.

## Planning change policy

- A milestone status changes to `done` only when its exit criteria are met.
- Moving an item to another milestone requires a note in this document.
- Partial work stays `wip`; it is not counted as done.
- The feature table is updated in the same change as the implementation.
- No schedule claim is made from the raw feature count.
