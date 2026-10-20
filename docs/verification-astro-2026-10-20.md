# Astro migration verification

Verified on October 20, 2026 against the local static build.

## Content accounting

- The 18 current SQLite rows were compared with the catalog before removing the server code. Each row's title, diagram type, source bytes, and lesson JSON matched a catalog entry. The two evaluation UUIDs contain the same lesson, yielding 17 canonical articles.
- `src/legacy-ids.json` retains all 18 UUID-to-slug mappings. Each article includes its mapped IDs in frontmatter.
- All catalog lesson fields, walkthrough steps, decisions, failure modes, takeaways, references, and scope notes are present in the MDX articles. All 17 catalog source digests match `catalog/acceptance.json`.

## Build and static output

- `npm test` passed: migration/content checks, Astro diagnostics (0 errors and 0 warnings), the production build, and a generated-route check.
- The build generated 60 HTML pages: 17 articles, an article index, four topic pages and topic index, a homepage, and 36 legacy UUID and editor-route redirect pages. It also emitted 17 standalone Archify readers under `dist/diagrams/<slug>/reader.html`.
- An independent internal-link pass over generated site pages found no missing local targets.
- The build uses Astro's static output and the vendored Archify CLI. No SQLite file is present in `dist/`; no running application server is needed to serve it.

## Browser inspection

- Served `dist/` using Python's static file server, then inspected the homepage and all 17 articles in the in-app browser at 390 px and 1440 px widths. Every article had its expected title, embedded the matching Archify reader, exposed a usable zoom control inside the reader, and had no page-level horizontal overflow.
- Verified the `ai-evaluation` article's embedded reader, its sandbox attribute, its full-view link, and interactive zoom from 100% to 125%.
- Verified a legacy UUID route reaches the canonical article.
- At 320 px and 390 px widths, the article had no horizontal overflow; the embedded reader also fit its frame at 320 px. The publication date displayed as October 19, 2026 after UTC date formatting.
- The article introduces the problem and a reading cue before its diagram. The sandboxed reader's zoom control changed from 100% to 125% during inspection.
- The article's objectives, diagram, teaching sections, references, and related links appeared in the browser accessibility tree.

## Limits

- Zoom interaction was exercised on one representative reader. All 17 readers were loaded in the browser at phone and desktop widths, and each exposed the zoom control. Prior Archify acceptance receipts cover all 17 source definitions. The previous full native acceptance suite, including every export and theme combination, was not rerun during this migration.
- The retired create/edit/delete UI is an intentional scope change. Authoring now uses version controlled MDX and Archify JSON. Existing local SQLite files remain ignored backups in `data/`; they are not part of the site or build.
- The browser used for inspection was the in-app browser. A direct Playwright launch of the local Chrome binary aborted in this sandbox, so the retired browser walkthrough could not be reused.
