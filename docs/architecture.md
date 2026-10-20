# Architecture

Diagram Desk is a static publication. Its diagram examples teach other systems;
they are not services running behind this site.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/content/articles/` | Authored MDX lessons and frontmatter |
| `src/content.config.ts` | Astro collection loader and metadata schema |
| `catalog/index.json` | Diagram metadata, original IDs, and lesson migration baseline |
| `catalog/diagrams/` | Native Archify JSON definitions |
| `src/pages/` | Home, article/topic listings, articles, and legacy redirects |
| `src/components/` | Article cards and sandboxed reader embeds |
| `src/layouts/`, `src/styles/` | Shared publication layout and responsive styles |
| `src/lib/urls.ts` | Application paths under the configured hosting base |
| `src/legacy-ids.json` | Original UUID-to-article mapping |
| `vendor/archify/` | Version controlled renderer with license and upstream notices |
| `scripts/` | Reader generation, parity checks, and static output checks |

## Build and runtime

`npm run build` first runs `scripts/build-readers.mjs`. For each catalog entry,
it checks metadata against the native JSON, renders a reader using the vendored
Archify CLI in a temporary directory, and adds source SHA-256 metadata and a
touch interaction adapter. The temporary directory is removed after rendering.
Readers are regenerated under ignored `public/diagrams/<slug>/reader.html`.

Astro then validates and renders the MDX collection, bundles the article styles,
and copies the public readers into `dist/`. Each article embeds its reader in an
iframe and offers a full-view link to the same file. The iframe allows scripts
and downloads and omits same-origin access. Readers carry their own interaction
code; there is no diagram service to call at runtime.

The browser requests static HTML, CSS, and diagram readers from the host.
Article styles load Google Fonts. Followed source-reference links lead to
external sites. The app has no user accounts, database, write API, analytics
integration, or browser authoring workflow.

## Migration and verification

The 18 original IDs map to 17 canonical lessons. Both old viewer and editor
URLs emit static redirects with ordinary fallback links. Original catalog
text and UUID coverage are checked by `scripts/check-migration.mjs`; the
[migration audit](archify-migration.md) records topic preservation.

`npm test` checks parity and Astro types, builds the root site, and scans its
generated internal destinations. CI repeats the build/check at the GitHub Pages
base path before uploading an artifact. Native diagram acceptance is a separate
`npm run check:catalog` command requiring Chrome or Chromium. Browser inspection
is still needed to verify layout, reader behavior, and deployed assets.

See [the contribution guide](../CONTRIBUTING.md) for authoring and checks, and
[the deployment guide](deployment.md) for build settings and publication.
