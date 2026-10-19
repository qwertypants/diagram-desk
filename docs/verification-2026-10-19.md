# Verification: Archify learning library

Verified on October 19, 2026 using the local Node runtime and isolated Chrome
sessions. No diagram examples execute real model or tool operations.

## Results

- Production build passed.
- All 165 unit, DOM, API, persistence, and migration tests passed.
- All 124 integrated browser checks passed, including the 17 distinct catalog
  topics at desktop and phone sizes in both themes.
- Every catalog candidate passed Archify's validation, delivery, strict artifact
  check, and browser check. `catalog/acceptance.json` binds those results to the
  exact candidate digests. Both original evaluation records use one checked
  candidate while retaining separate saved identities.
- Browser checks exercised create, edit, save, reload/deep links, search, invalid
  input, discard confirmation, deletion, node search, zoom, phone dragging,
  two-finger pinch, SVG/PNG downloads, and the mobile library drawer, including
  keyboard focus trapping, Escape/backdrop closing, and responsive resizing.
- External runtime requests were blocked throughout the browser walkthrough;
  none were attempted. No browser errors were observed.
- The real database was migrated and read back: 18 native records, with every
  original ID and both timestamps preserved. A repeated apply changed nothing.

## Visual review

Contact sheets for all 17 topics in both themes were inspected. The long
streaming sequence and six-lane pattern comparison were additionally inspected
as full-height standalone readers. A complete phone lesson and the integrated
reading layout were inspected separately. Automated containment and text-size
checks cover every topic/theme pair on mobile.

Detailed native receipts are under `.archify/final-20261019/`. Integrated browser
captures and `report.json` are under `.archify/browser/`. These files are local
verification artifacts and are excluded from version control.

## Backup and operation

The pre-migration SQLite backup is:

`data/diagrams-before-archify-1792446939293.sqlite`

Stop the app before restoring it. Keep the current database separately if it
contains later edits. The running service uses the repository's real
`data/diagrams.sqlite`, not a browser-test fixture.

## Limits

- Dense native diagrams use zoom, drag, search, and semantic focus. The app adds
  touch gesture compatibility without replacing Archify's camera or modifying
  the vendored renderer.
- Native `meta.views` groups are retained as authoring hints. Archify 3.2's reader
  does not expose dedicated group tabs; the app's numbered reading path supplies
  that teaching structure.
- Clipboard, saved native preferences in opaque frames, and WebM recording are
  browser-dependent and were not part of the verified export set. SVG and PNG
  downloads were verified.
- Local integration uses ordinary Git at the user's request. The implementation
  and the remaining phone-navigation branch are integrated onto `main`.
  No push or pull request is included.
