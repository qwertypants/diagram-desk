# Maintain the installable offline library

Diagram Desk installs as a standalone reading app. Its service worker saves the
complete published library, including article and topic pages, companions,
standalone Archify readers, native diagram JSON, styles, icons, and legacy
redirect pages. Installation and offline storage depend on browser support and
available device storage. External reference sites remain online resources.

## Build and verify

Use Node.js 24 or newer and install dependencies with `npm ci`. The worker must
be generated after Astro and the external-link decorator finish. Generating it
earlier records hashes for HTML that the decorator subsequently changes and
causes the browser to reject installation.

Check both hosting paths before publishing:

```sh
npm test
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ npm run build
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ node scripts/check-static.mjs
BASE_PATH=/diagram-desk/ node scripts/check-pwa.mjs
```

Use the same `SITE_URL` and `BASE_PATH` for the prefixed preview:

```sh
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ npm run preview
npm run test:browser -- http://localhost:4321/diagram-desk/
npm run test:install -- http://localhost:4321/diagram-desk/
npm run test:offline -- http://localhost:4321/diagram-desk/
```

`check-pwa.mjs` checks the actual built manifest and PNG dimensions. It executes
the generated worker's install, activate, and fetch events in a simulated browser
environment. It compares every cached file with its bytes in `dist/`, exercises
directory aliases and reader query parameters, corrupts a download to verify
integrity rejection and cleanup, and checks that activation preserves caches for
other applications and deployment paths. This check does not prove browser
storage persistence, platform installation, or the physical device experience.

## Change content and assets

Edit MDX in `src/content/articles/` and `src/content/companions/`, native diagrams
in `catalog/diagrams/`, and their catalog entry together. Rebuild readers from
those sources. Do not edit or commit generated `public/diagrams/`, `dist/`, or
local browser verification evidence.

Keep resources needed for offline reading on this origin under the deployment
base. A remote image, font, script, or stylesheet cannot become an offline
dependency merely by linking it from an article. Bundle required assets into
`public/` or import them through Astro, and verify the generated file appears in
the worker's library cache. External article references remain ordinary links.

The manifest needs an ordinary PNG icon at 192 and 512 pixels, a separate
maskable 512-pixel icon, and an Apple touch icon linked from application pages.
Keep maskable artwork inside its safe area and inspect the result with circular
and rounded-square masks. Update the source icons and rebuild the entire site.
Use base-aware URLs for the manifest, icons, start URL, scope, and worker.

## Cache versions and updates

The build derives the cache version from published content. A change to an
article, reader, diagram JSON, icon, stylesheet, or other cached file must change
the version. An identical rebuild must retain the same version. Do not add a
timestamp or manually maintain a release number to force refreshes.

The worker fetches and verifies all library bytes before installation succeeds.
A missing file, failed request, or SHA-256 mismatch must reject the candidate and
remove its partial cache. The previous active worker and complete cache remain
available. Publish the complete verified `dist/` artifact together through the
existing GitHub Actions workflow.

A complete update activates when the page detects a waiting worker and the
previous page is already controlled. The existing page reloads once after the
new worker takes control, so it reads the matching cached release. The first
installation does not reload the page when it gains its initial controller.
Activation removes obsolete caches only for the same base path. Another
application or another Diagram Desk deployment keeps its own caches.

To roll back, revert the faulty source change and rebuild through the normal
workflow. Previously cached clients receive the rollback as another update.
Clearing site data is a troubleshooting step that removes offline access; it is
not the normal update process.

## Browser and device acceptance

Serve a production build on localhost or HTTPS. Development servers must not
leave a production worker controlling development pages. Use a fresh browser
profile when comparing versions, and remove test registrations and caches when
finished.

1. Open the home page online, wait for offline preparation to complete, and
   inspect the registration scope and library cache in browser developer tools.
   Confirm the worker and manifest stay under the configured repository prefix.
2. Use keyboard navigation to reach the install control. Its label, platform
   guidance, close control, and status messages must be understandable to a
   screen reader. A dismissed prompt must leave the page usable. Verify that
   unsupported browsers do not display a nonfunctional native-install button.
3. Test the supported native install flow on a browser that emits
   `beforeinstallprompt`. Check the iPhone instructions in Safari and confirm
   they describe that platform's browser menu. Emulated user agents verify
   gating logic; a physical device verifies actual installation.
4. Launch the installed app. Confirm its standalone layout hides redundant
   installation prompts. Keep article and diagram controls reachable at phone
   width and with larger text.
5. Disable the network after the complete library is ready. Open a previously
   unvisited article, topic page, companion, standalone reader, and native JSON
   URL. Follow both legacy UUID URL forms. Reload an article directly. Exercise
   reader zoom and an embedded reader with its query parameters.
6. Keep a page from release A open, then serve or publish release B at the same
   origin and base. Confirm the page remains usable while B downloads, then
   reloads once when B takes control and shows B content. Confirm first install
   does not reload. Corrupt one B asset and confirm A remains available offline;
   restore B, trigger update discovery, and confirm clients converge on B. Repeat
   with a rollback build. These two-release transitions require manual acceptance;
   the current single-build checks do not automate upgrade or rollback coverage.

Report local automated results, browser behavior, device installation, and live
publication separately. A successful static build is not evidence that an app
was installed or that browser storage will never be evicted.

Keep repository-path URLs canonical with their trailing slash. A worker scoped
to `/diagram-desk/` cannot intercept an initial offline request for the distinct
`/diagram-desk` URL before a server has redirected it; the manifest, navigation,
and generated links all use the controlled trailing-slash form.
