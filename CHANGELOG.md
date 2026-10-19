# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

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
