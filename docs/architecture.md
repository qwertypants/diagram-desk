# Architecture

Diagram Desk is a static publication. Its diagram examples teach other systems;
they are not services running behind this site.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/content/articles/` | Authored MDX lessons and frontmatter |
| `src/content/companions/` | Separately authored short MDX explanations for full-view diagrams |
| `src/content.config.ts` | Astro collection loader and metadata schema |
| `catalog/index.json` | Diagram metadata, original IDs, and lesson migration baseline |
| `catalog/diagrams/` | Native Archify JSON definitions |
| `src/pages/` | Home, article/topic listings, articles, companions, and legacy redirects |
| `src/components/` | Article cards and sandboxed reader embeds |
| `src/layouts/`, `src/styles/` | Shared publication layout and responsive styles |
| `src/lib/urls.ts` | Application paths under the configured hosting base |
| `src/legacy-ids.json` | Original UUID-to-article mapping |
| `vendor/archify/` | Version controlled renderer with license and upstream notices |
| `scripts/` | Reader generation, content relationship checks, and static output checks |

## Build and runtime

`npm run build` first runs `scripts/build-readers.mjs`. For each catalog entry,
it checks metadata against the native JSON, renders a reader using the vendored
Archify CLI in a temporary directory, and adds source SHA-256 metadata and a
touch interaction adapter. The temporary directory is removed after rendering.
Readers are regenerated under ignored `public/diagrams/<slug>/reader.html`.

Each article has a separately authored companion with the same slug. Articles
live at `/articles/<slug>/`; the companion and its embedded diagram live at
`/diagrams/<slug>/`; and the canvas-only reader remains at
`/diagrams/<slug>/reader.html`. A companion has `title`, `description`, and
`diagram` frontmatter and imports `DiagramEmbed` with `companion={true}`, a
heading, and a reading cue. Its full-article link gives direct diagram visitors
a path to the longer lesson. Original UUID routes continue to redirect to the
matching article.

Astro then validates and renders the MDX collections, bundles the page styles,
and copies the public readers into `dist/`. Each article embeds its reader in an
iframe and links to the companion. The companion embeds its reader and offers a
canvas-only link to the standalone file. The iframe allows scripts, downloads, and user-activated popups that escape
the sandbox, so external reader links can open normally. It omits same-origin
access. Readers carry their own interaction code; there
is no diagram service to call at runtime.

After Astro builds, `scripts/decorate-external-links.mjs` parses every generated
HTML document and decorates HTTP(S) links to other origins. External links open
in a new tab with `noopener noreferrer`; the only visible indicator is `↗`,
with the new-window explanation available to screen readers. Internal links,
email links, and downloads keep their existing behavior.

The browser requests static HTML, CSS, and diagram readers from the host.
Article styles load Google Fonts. Followed source-reference links lead to
external sites. The app has no user accounts, database, write API, analytics
integration, or browser authoring workflow.

## Migration and verification

The 18 original IDs map to 17 canonical lessons. Both old viewer and editor
URLs emit static redirects with ordinary fallback links. Chart identity, article/companion relationships, and UUID coverage are checked
by `scripts/check-migration.mjs`; catalog lesson prose remains historical input. The
[migration audit](archify-migration.md) records topic preservation.

`npm test` runs content/link behavior tests, checks relationships and Astro types,
builds the root site, and scans generated internal destinations and external-link
indicators. CI repeats the build/check at the GitHub Pages
base path before uploading an artifact. Native diagram acceptance is a separate
`npm run check:catalog` command requiring Chrome or Chromium. Browser inspection
is still needed to verify layout, reader behavior, and deployed assets.

See [the contribution guide](../CONTRIBUTING.md) for authoring and checks, and
[the deployment guide](deployment.md) for build settings and publication.
