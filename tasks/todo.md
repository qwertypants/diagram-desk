# Diagram Pan and Zoom Tasks

## Phase 1: Diagram navigation

### Task 1: Add pan and pointer-centered wheel zoom
- [x] Add a viewer navigation surface around the rendered Mermaid SVG.
- [x] Support click-drag panning with pointer capture.
- [x] Support bounded, pointer-centered wheel/trackpad zoom only while the pointer is over the diagram.
- [x] Manually verify drag, including release outside the viewport, zoom bounds, and wheel behavior inside and outside the diagram.

### Task 2: Add accessible plus/minus controls
- [x] Add visible `+` and `−` buttons wired to the same zoom state.
- [x] Add accessible names, keyboard operation, and disabled states at zoom limits.
- [x] Style controls for desktop and narrow viewports.
- [x] Manually verify mouse and keyboard use at zoom limits on desktop.
- [ ] Verify controls do not overflow a narrow viewport.

## Checkpoint: Navigation works
- [x] Drag, wheel/trackpad, plus/minus, and keyboard controls navigate a saved diagram.
- [x] Editor preview and persisted diagram source are unchanged.

## Phase 2: Runtime verification

### Task 3: Verify in the running browser
- [x] Exercise the saved diagram view at desktop width; confirm the interaction stays within the viewport.
- [x] Confirm the browser console has no warnings or errors.
- [ ] Exercise at a narrow viewport. The available browser controls do not expose viewport resizing; the responsive CSS was reviewed instead.

## Checkpoint: Complete
- [ ] All planned controls work in the saved diagram view at desktop and narrow widths.
