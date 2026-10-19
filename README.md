# Diagram Desk

An offline visual learning library for software and AI systems. Explore an
interactive Archify diagram, follow a guided reading path, and examine the
engineering decisions and failure modes behind it.

The library includes all 13 original diagrams and five new production-oriented
lessons. Both original evaluation records keep their own identity.

## Run locally

Requires Node.js 24 or newer and npm.

```sh
npm ci
npm start
```

Open [Diagram Desk](http://127.0.0.1:4317). A fresh database starts with 18 saved
records. Deleting or editing a lesson persists across restarts. The app does not
reseed an initialized library.

Everything runs on this machine. The server binds loopback, stores data in
SQLite, and compiles diagrams with the vendored Archify 3.2.0 distribution.
No global Archify installation, account, telemetry, model API, or CDN is needed.
Reference links open external documentation only when the reader chooses them.

## Migrate an existing library

Stop the running server before migration, then run:

```sh
npm run migrate:archify                 # inspect the proposed conversion
npm run migrate:archify -- --apply      # back up, then convert transactionally
npm start
```

The migration recognizes the original records by ID and source digest. It
preserves their IDs, titles, and creation/update timestamps, including the
identical evaluation records. Unknown or edited legacy source stops the
migration without overwriting it. Review that content and add a checked mapping
before retrying. No general-purpose Mermaid converter runs at application time.

The apply command prints the SQLite backup path. To restore it, stop the server,
preserve the current database, and copy that backup to `DIAGRAMS_DB` or
`data/diagrams.sqlite`. Do not restore over a running SQLite connection.

Catalog acceptance is bound to candidate source digests in
[`catalog/acceptance.json`](catalog/acceptance.json). After changing a catalog
candidate, run `npm run check:catalog` before applying a migration. It requires
local Chrome or Chromium and writes detailed evidence under `.archify/`.

## Read and author

Choose a lesson in the library. Objectives explain what to look for; the
numbered reading path explains the flow; decisions and failure modes provide
context. Use native node search and focus to inspect dense architecture diagrams.

The native reader provides node focus, search, relationship exploration,
light/dark themes, motion controls, and exports. Open **Open full reader** when
you need more room. Reduced-motion settings retain static diagram meaning.

**New diagram** opens an Archify JSON editor. Choose a diagram type and load its
starter, or paste a native candidate. The selected type must match
`diagram_type`. The preview validates and renders locally; an invalid preview
blocks Save. Optional learning notes are edited separately as JSON.

Learning-note fields are `summary`, `problem`, `objectives`, `walkthrough`,
`decisions`, `failureModes`, `takeaways`, `scope`, and `references`. Reading steps
have `title` and `detail`; references have `title` and an HTTP(S) `url`.

A starter replaces the source in the editor. Save or copy work you want to keep
before loading one. The application title and native `meta.title` are separate;
edit both when renaming the diagram itself.

## Five new lessons

- **A support agent that earns permission:** authorization before tools,
  operation-specific human approval, receipts, and uncertain outcomes.
- **Answer only from usable evidence:** ingestion, scoped hybrid retrieval,
  reranking, evidence sufficiency, citations, and grounding checks.
- **Research agents with owned work:** bounded delegation, independent evidence,
  coverage review, synthesis, and explicit gaps.
- **Find the regression behind the answer:** trace correlation, production
  sampling, fixed evaluation cases, and release decisions.
- **An approval that survives a crash:** durable approval, retry budgets,
  receipt reconciliation, and terminal outcomes.

All designs are educational examples. Sources establish individual practices;
they do not claim that these exact composite systems are deployed. The
[migration audit](docs/archify-migration.md) records preserved meaning and
corrections for every original topic.

## Configuration and development

| Setting | Default |
| --- | --- |
| `PORT` | `4317` |
| `DIAGRAMS_DB` | `data/diagrams.sqlite`, relative to the repository root |

```sh
npm test                    # unit, DOM, persistence, migration, and API tests
npm run build               # static client into dist/
npm run serve               # serve an existing build
npm run test:browser        # own temporary server/database; Chrome required
npm run check:catalog       # native acceptance gates for every catalog candidate
```

The browser walkthrough captures every catalog topic at desktop and mobile
sizes, in both themes, while blocking external runtime requests. Evidence lives
in `.archify/browser/`. `tilt up` remains an optional development entry point for
the same local Node process, with catalog, starter, and renderer dependencies.

## Architecture and limits

The client uses vanilla ES modules and the History API. The Node HTTP server
provides the [JSON API](docs/api-contract.md), static assets, a bounded preview
cache, and isolated native readers. SQLite stores canonical source and lesson
metadata. Compilation uses private temporary directories, a 30-second timeout,
and at most two concurrent render processes. Cached previews expire after ten
minutes; saved readers regenerate from source after restart.

Readers run in opaque sandboxed frames with compiler-script hashes and no
network access. The host application keeps its restrictive script policy.
Browser restrictions in opaque frames can limit persistent native preferences,
clipboard actions, or video capture. PNG/SVG downloads and touch interaction are
checked separately. The mobile experience contains the native diagram and
provides readable lesson text; dense diagrams require pan/zoom or the full
reader. Archify does not promise a complete phone-specific presentation mode.

The server is for one trusted local user and has no authentication. Public
exposure requires an authenticated reverse proxy. See [SECURITY.md](SECURITY.md).

## License

The application is MIT licensed. Archify is vendored under its MIT license with
upstream third-party notices intact in `vendor/archify/`.
