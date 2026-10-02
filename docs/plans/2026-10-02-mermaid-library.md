# Personal Mermaid Diagram Library

## Summary

Build a local site for pasting Mermaid code, previewing it, and saving titled diagrams in SQLite. The main screen keeps a searchable library beside a large diagram viewer. Reopening a diagram shows the render first; editing opens source and preview together.

Use a warm "drafting desk" design: paper tones, dark ink, fine grid details, and one rust accent. The first version excludes accounts, online hosting, folders, tags, bulk import, and prose-to-diagram generation.

## Implementation

- Use vanilla HTML, CSS, and JavaScript. Bundle Mermaid locally with Vite so rendering works without a CDN after installation. Use Mermaid's browser `parse` and `render` APIs for preview and validation. [Mermaid API](https://mermaid.js.org/config/usage), [Vite build guide](https://vite.dev/guide/build)
- Serve the built site and API from one Node server bound to `127.0.0.1`. Use the installed Node 26 runtime's `node:sqlite` API and an ignored `data/diagrams.sqlite` file. `npm start` builds and serves the app. Node currently labels this SQLite API a release candidate. [Node SQLite documentation](https://nodejs.org/download/release/v26.5.1/docs/api/sqlite.html)
- Store each diagram's UUID, title, Mermaid source, creation time, and update time. Provide `GET /api/diagrams?q=`, `GET /api/diagrams/:id`, `POST /api/diagrams`, `PUT /api/diagrams/:id`, and `DELETE /api/diagrams/:id`. Writes accept `{title, source}`; errors return an HTTP status and `{error}`.
- Search titles case insensitively and show recently updated diagrams first. Give each diagram a bookmarkable local URL. Require a title and a successful preview before enabling Save. Warn before discarding unsaved edits; confirm deletion. Keep failed saves in the editor with a visible error.

## Agentile execution

The repository is clean but has **no base commit**, app files, or other worktrees. The root orchestrator first saves this plan to `docs/plans/2026-10-02-mermaid-library.md`, creates the shared package setup and API contract, ignores the database and worktree directories, and commits that baseline on `main`. Worktrees start only from that commit.

| Agent | Start gate and ownership | Deliverable |
| --- | --- | --- |
| Root orchestrator | Owns the plan, package files, API contract, `main`, integration, and final verification | Baseline commit and integrated app |
| API worker | From baseline in `.worktrees/diagram-api` on `codex/diagram-api`; owns `server/**` and its tests | SQLite storage and HTTP API |
| UI worker | From baseline in `.worktrees/diagram-ui` on `codex/diagram-ui`; owns `index.html`, `src/**`, and its tests | Responsive library, viewer, editor, and Mermaid preview |
| Independent reviewer | Read only, after integration; no worktree | Findings on persistence, error handling, accessibility, and local-only access |

The API and UI workers start together after the baseline commit. Each commits only owned files and reports its branch, commit hash, changed paths, checks run, and unresolved issues. Root reviews and integrates the API commit, then the UI commit, resolves conflicts centrally, and runs combined checks in `main`. Worktrees are removed only after their commits are integrated and verified.

## Verification and completion

Test API create, search, fetch, update, delete, missing IDs, bad input, and persistence across a server restart. In a real browser, test paste → preview → save → reload → search → reopen → edit → delete; invalid Mermaid, unsaved changes, save failure, keyboard use, narrow layouts, and rendering with network access disabled after installation. Completion requires those flows to work against the actual SQLite file, passing build and tests, an independent review, and no required changes left only in a worktree.

## First execution wave

After the mode changes from Plan Mode, root writes the approved plan file and establishes the baseline commit. Then the API and UI workers start in separate worktrees from that commit; integration waits for both committed handoffs.