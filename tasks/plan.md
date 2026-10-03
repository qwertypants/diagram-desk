# Implementation Plan: Diagram Pan and Zoom

## Overview

Add familiar, map-style navigation to the saved diagram viewer so people can drag to pan and use the mouse wheel, trackpad, or visible zoom buttons to inspect a rendered Mermaid diagram.

## Architecture Decisions

- Keep navigation in `createViewerPanel`; the editor's live preview stays unchanged.
- Apply navigation to a wrapper around the rendered SVG so Mermaid source, SVG content, and persisted diagram data remain unchanged.
- Use pointer events for drag panning and wheel events for pointer-centered zoom. Keep zoom bounded and prevent wheel events from scrolling the page only while the pointer is over the diagram.
- Provide labeled `+` and `−` buttons, with accessible names and disabled states at zoom limits.
- No external plugin or service is needed; this is a local UI capability.

## Task List

### Phase 1: Diagram navigation
- [x] Task 1: Add pan and pointer-centered wheel zoom to the saved diagram view.
- [x] Task 2: Add accessible plus/minus controls and map-style styling.

### Checkpoint: Navigation works
- [x] Dragging pans the diagram, and wheel/trackpad input zooms toward the pointer.
- [x] Plus/minus buttons zoom within the same bounds and are keyboard operable.
- [x] The editor preview and diagram source remain unaffected.

### Phase 2: Runtime verification
- [ ] Task 3: Verify the interaction in the running browser at desktop and narrow viewport sizes; adjust any layout or pointer issues found.
  - [x] Desktop pan, wheel zoom, zoom limits, keyboard panning, and editor-preview scope verified in the browser.
  - [x] Browser console has no warnings or errors.
  - [ ] Narrow viewport browser check (the available browser control has no viewport override; responsive layout was reviewed in CSS).

### Checkpoint: Complete
- [ ] All controls work in the saved diagram view, and navigation remains contained within the diagram viewport at desktop and narrow widths.

## Task Details

### Task 1: Add pan and pointer-centered wheel zoom

**Description:** Add a navigation surface around the rendered SVG in the saved diagram viewer. Support click-drag panning, wheel/trackpad zoom centered at the pointer, and sensible bounded zoom levels.

**Acceptance criteria:**
- [x] Dragging within the diagram pans it, including when the pointer leaves the surface before release.
- [x] Wheel/trackpad input over the diagram zooms toward the pointer; the same input outside it does not get intercepted.
- [x] Zoom stays within defined minimum and maximum bounds.

**Verification:** Manually exercise drag, wheel, zoom bounds, and wheel behavior outside the diagram in the running browser.

**Dependencies:** None.

**Files likely touched:**
- `src/viewer-panel.js`
- `src/styles.css`

**Estimated scope:** Medium.

### Task 2: Add accessible plus/minus controls

**Description:** Add visible zoom-in and zoom-out buttons to the diagram viewer and style them as compact map-style controls.

**Acceptance criteria:**
- [x] `+` and `−` controls adjust the same zoom state used by wheel input.
- [x] Controls have accessible names, work from the keyboard, and indicate when their zoom limit is reached.
- [ ] Controls remain usable without overflowing the viewport at narrow viewport sizes.

**Verification:** Mouse and keyboard use, including zoom limits, is verified on desktop. Narrow viewport verification is tracked in Task 3.

**Dependencies:** Task 1.

**Files likely touched:**
- `src/viewer-panel.js`
- `src/styles.css`

**Estimated scope:** Small.

### Task 3: Verify in the running browser

**Description:** Exercise the saved diagram flow in the existing browser runtime and correct any interaction or responsive layout issues.

**Acceptance criteria:**
- [ ] Pan, wheel zoom, and plus/minus controls work on a rendered saved diagram.
- [ ] The live editor preview remains unchanged.
- [ ] Controls remain accessible and usable at desktop and narrow viewport widths.

**Verification:** Run the existing app and follow the manual interaction checklist above.

**Dependencies:** Tasks 1-2.

**Files likely touched:**
- `src/viewer-panel.js` (only if runtime findings require a correction)
- `src/styles.css` (only if runtime findings require a correction)

**Estimated scope:** Small.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wheel zoom also scrolls the page while inspecting a diagram | High | Prevent default only for wheel events targeted within the diagram viewport. |
| Pointer is released outside the viewport during a drag | Medium | Use pointer capture and release handling. |
| Zoomed SVG is clipped or controls obscure it on narrow screens | Medium | Keep the viewport scrollable/contained and check the running browser at a narrow width. |
| Shared canvas styles accidentally change the editor preview | Medium | Scope navigation-specific styles to the saved viewer surface. |

## Open Questions

- None. Zoom bounds and step size can be chosen as implementation details and adjusted if browser use shows they feel wrong.
