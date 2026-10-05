# Diagram Desk

A local-first library of [Mermaid](https://mermaid.js.org/) diagrams. Write
Mermaid source in a live preview, save it, and come back to it later — search,
view, edit, and delete. Everything runs on your machine: a small Node server, a
SQLite file, no cloud account, no external network calls.

- **Local-first.** Diagrams live in `data/diagrams.sqlite` on your disk. Point
  `DIAGRAMS_DB` anywhere you like.
- **No accounts, no telemetry, no external services.** The only runtime
  dependency is Mermaid itself, bundled into the static site at build time.
- **Deep links.** Every view has a URL (`/`, `/new`, `/diagrams/<id>`,
  `/diagrams/<id>/edit`), so you can bookmark links on this machine.
- **Plain API.** A documented JSON API over the same store the UI uses
  ([`docs/api-contract.md`](docs/api-contract.md)).

## Requirements

- Node.js 24 or newer (this is what `node --test` and the ESM server need)
- npm (ships with Node)

## Quick start

From the project directory, run:

```sh
npm ci
npm start
```

`npm start` builds the site and then serves it on
<http://127.0.0.1:4317>. Open that URL in a browser and you are in the library.

Your database is created automatically on first run — there is nothing to
migrate or seed.

### The npm scripts

| Script | What it does |
| --- | --- |
| `npm start` | Build the site, then run the server |
| `npm run build` | Build the static site into `dist/` |
| `npm run serve` | Run the server against an existing `dist/` |
| `npm test` | Run the unit and DOM test suites (`node --test`) |
| `npm run test:browser` | Drive a real browser through the whole flow (see below) |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4317` | Port the server binds on `127.0.0.1` |
| `DIAGRAMS_DB` | `data/diagrams.sqlite` | Path to the SQLite file |

The server binds `127.0.0.1`, never `0.0.0.0`. It is designed for a single
trusted user on their own machine, not for the open internet. If you want to
expose it, put a reverse proxy with real authentication in front of it.

## How it works

```
browser ── HTTP ──> node server (127.0.0.1:4317)
                       ├── /api/*      JSON API
                       └── everything else   static site from dist/
                       │
                       └── data/diagrams.sqlite   SQLite (created on start)
```

- **Client** (`src/`) — vanilla ES modules, no framework. Routing via the
  History API, four views: the library, the compose screen, a saved diagram,
  and the editor.
- **Server** (`server/`) — `node:http` only, no web framework. One handler for
  the API, one for static files, one small SQLite wrapper.
- **Build** — Vite bundles Mermaid and the client into `dist/`.

### Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `src/` | Client: routing, panels, Mermaid rendering |
| `server/` | HTTP server, JSON API, SQLite store |
| `test/` | Unit and jsdom-based tests for `src/` and the API |
| `server/*.test.js` | Server tests, colocated with their modules |
| `scripts/browser-check.mjs` | Playwright end-to-end walkthrough |
| `docs/api-contract.md` | The binding API contract |
| `docs/plans/` | Design notes for past work |

## Testing

```sh
npm test
```

Tests cover the API contract, validation, persistence, routing, and the
UI panels (rendered in jsdom). No browser required.

There is also a real-browser walkthrough — create, preview, save, reopen,
search, edit, delete, plus invalid Mermaid, unsaved-changes handling, narrow
layouts, and rendering with every external origin blocked:

```sh
npm start           # in one terminal
npm run test:browser # in another
```

It drives Google Chrome through Playwright against `http://127.0.0.1:4317`
(override with `DIAGRAMS_BASE_URL`). It needs a local Chrome install — the
Playwright devDependency provides the driver, not the browser.

CI runs both suites.

## API

The UI is a client of the same public API anyone else can use. Full details in
[`docs/api-contract.md`](docs/api-contract.md); the short version:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/diagrams?q=<term>` | List diagrams, newest first. `q` filters on title. |
| `GET` | `/api/diagrams/:id` | Fetch one diagram |
| `POST` | `/api/diagrams` | Create — `{"title", "source"}` |
| `PUT` | `/api/diagrams/:id` | Replace title and source |
| `DELETE` | `/api/diagrams/:id` | Delete permanently |

```sh
curl -X POST http://127.0.0.1:4317/api/diagrams \
  -H 'content-type: application/json' \
  -d '{"title":"Order flow","source":"flowchart TD\n  A[Start] --> B[End]"}'
```

Writes require `content-type: application/json` and get a `415` without it —
that is what stops another web page from writing to your library with a
no-preflight request. There is no authentication; see
[Configuration](#configuration).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: `npm test` must pass, and
new behavior needs a test.

## Security

Please do not report vulnerabilities in a public issue — see
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Diagram Desk contributors
