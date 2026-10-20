# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Static Astro publication with 17 MDX articles, native Archify readers, topic navigation, and 36 legacy URL redirects.
- GitHub Pages deployment after dependency audit, type/content checks, and verified root and repository-path builds.
- Hosting and architecture guides, current contribution and security policies, and updated issue templates.
- Dark mode follows the device appearance setting and updates immediately when
  that setting changes, with matching page, article, and diagram-frame colors.

### Changed

- Removed the SQLite API and browser create/edit/delete workflow. Authoring now uses MDX and native Archify JSON in the repository.
- Retained legacy diagram IDs as links to canonical articles.
- Added base-aware page, reader, and redirect URLs for GitHub Pages.
- Updated the vulnerable transitive HTTP cache dependency to its patched release.
- Kept planning and task directories local instead of tracking them in future commits.

## [1.0.0] - 2026-10-02

First public release.

### Added

- Local library of Mermaid diagrams backed by SQLite, with a JSON API
  (`GET`/`POST`/`PUT`/`DELETE` on `/api/diagrams`) and a documented contract in
  `docs/api-contract.md`.
- Four routed views: the library, the compose screen, a saved diagram, and the
  editor. Every view is deep-linkable via the History API.
- Live Mermaid preview with parse errors surfaced before anything is sent to
  render.
- Search over diagram titles, ordered by most recently updated.
- Unsaved-changes protection when navigating away from a dirty draft.
- Playwright browser walkthrough covering create, preview, save, reopen,
  search, edit, delete, invalid Mermaid, narrow viewports, and rendering with
  every external origin blocked.
- `Content-Security-Policy`, `x-content-type-options: nosniff`, and
  `x-frame-options` on every response.
- `415` on writes whose `content-type` is not `application/json`, blocking
  cross-origin no-preflight writes to the library.

### Notes

- The server binds `127.0.0.1` and ships without authentication. It is a
  single-user local tool; see [SECURITY.md](SECURITY.md) before exposing it.
## Archify learning library - 2026-10-19

- Replaced Mermaid rendering with local, sandboxed Archify readers and native JSON authoring.
- Added guided explanations and migrated all original topics while preserving saved IDs.
- Added five lessons covering permissioned agents, evidence-grounded retrieval, research coordination, trace-driven evaluation, and durable recovery.
- Added checked catalog artifacts, transactional migration with backups, fresh-install seeding, and desktop/mobile browser coverage.
