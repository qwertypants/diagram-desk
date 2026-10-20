# Working on Diagram Desk

Diagram Desk is a public, static Astro learning library. Articles are authored in
`src/content/articles/` as MDX; native diagram JSON lives in `catalog/diagrams/`.
`scripts/build-readers.mjs` renders the vendored Archify readers before Astro
builds the site into `dist/`. The former SQLite API and browser editor are retired.

## Scope and repository hygiene

- Keep documentation consistent with the current static app and its npm scripts.
- Use standard Git in this repository.
- Inspect the working tree before editing. Preserve unrelated and pre-existing work;
  commit explicit paths or hunks. Do not publish another session's work without
  authorization to include it.
- Keep plans, design notes, and task checklists local under `tasks/`, `docs/plans/`,
  or `docs/superpowers/`. These directories are ignored. Do not force-add them.
- Preserve unfinished local plans; create a separate named subdirectory for new work.
- Commit durable user and contributor documentation under `docs/` or at the root.
- Keep generated readers, build output, acceptance evidence, and secrets untracked.
- Do not push, publish, or change repository settings without user authorization.

## Verification and deployment

- Use Node.js 24 or newer and install dependencies with `npm ci`.
- `npm test` checks migration coverage and Astro types, builds the static site,
  and checks generated routes and readers. Do not restore retired server tests.
- For UI or deployment changes, inspect the built site at desktop and mobile sizes.
  Exercise article/topic navigation, diagram embeds and full view, and legacy links.
- Support both a root deployment and a GitHub Pages repository path. Verify local
  links, assets, reader URLs, canonical URLs, and redirects under that prefix.
- Publish `dist/` through GitHub Actions only after verification passes. Pull
  requests must not receive deployment credentials or publish the production site.
- Confirm the deployed URL and reader interactions before claiming publication is
  complete. Report local verification and live deployment results separately.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
