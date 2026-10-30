# Deploy Diagram Desk

The public library is at <https://qwertypants.github.io/diagram-desk/>.
The deployable artifact is `dist/`. It contains static pages, styles, and
standalone interactive diagram readers. Production needs no Node process,
database, API, credentials, or CMS.

## GitHub Pages setup

1. Fork or push the source to a public GitHub repository.
2. In **Settings → Actions → General**, enable GitHub Actions if disabled.
3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. Push to `main`, or run **CI and GitHub Pages** from the Actions tab on `main`.
   Fork workflows may need to be enabled explicitly in the Actions tab.
5. Wait for both **Check and build static site** and **Publish GitHub Pages**
   to succeed. The deployment environment shows the published URL.

The workflow installs Node 24 dependencies from the lockfile, audits packages,
checks content and types, and builds and verifies both root and Pages output.
The static checker derives route coverage from the current catalog and legacy
ID list, so adding lessons does not require updating a fixed count in this guide.
CI browser-checks the prefixed output at desktop and phone widths, including
companion navigation, canvas-only reader navigation, every embedded reader,
legacy redirects, and PWA update transitions. Only the verified Pages output is
uploaded. Pull requests do not upload or deploy.
The deploy job alone receives Pages write and OIDC permissions. No personal
access token or repository secret is required.

The workflow derives `SITE_URL=https://<owner>.github.io` and
`BASE_PATH=/<repository>/` from GitHub's repository metadata. An
`<owner>.github.io` repository uses `/`. If you rename your fork, the next build
uses its new name automatically. This workflow targets a branch named `main`;
update its push trigger and deployment conditions if your default branch differs.

## Preview the production path locally

Use Node.js 24 or newer, then run these commands in a POSIX shell:

```sh
npm ci
npm run check
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ npm run build
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ node scripts/check-static.mjs
SITE_URL=https://qwertypants.github.io BASE_PATH=/diagram-desk/ npm run preview
```

Open <http://localhost:4321/diagram-desk/>. Use the same variables for the build,
static checker, and preview. On PowerShell, set `$env:SITE_URL` and
`$env:BASE_PATH` before running the npm commands. For root hosting, leave
`BASE_PATH` unset and set `SITE_URL` to the deployment origin when building.

`SITE_URL` determines canonical URL origins; `BASE_PATH` determines local page,
asset, iframe, and redirect paths. These are public build settings, not secrets.
Changing them requires a rebuild. Keep application links base-aware with the
shared `withBase` helper. Astro handles its bundled styles under the same base.

## Verify a deployment

- Browse the home, articles, topics, and an individual topic page.
- Open an article, follow its companion link, and return to the full article.
  From the companion, open the canvas-only reader and exercise its controls.
- Follow a legacy `/diagrams/<UUID>/` or `/diagrams/<UUID>/edit/` link and
  confirm it reaches the matching article. These redirects are static HTML.
- Repeat at phone width; confirm the article fits the screen and reader controls
  remain usable. Inspect browser console and network failures.

The final static checker verifies 17 articles, 17 companions, 17 readers, 36
legacy routes, source identity metadata, external-link decoration, and generated
internal link/asset/iframe/redirect targets. It does not check the availability
of external reference sites. Run `npm test` for the complete local check and
build. With the prefixed preview running as above, run
`npm run test:browser -- http://localhost:4321/diagram-desk/` for navigation and
interaction coverage. For a root preview, use `http://localhost:4321/`.

## Troubleshooting and rollback

For a 404, check the Pages source, workflow logs, selected branch, and the URL's
repository prefix. For missing styles or diagrams, reproduce the prefixed local
build above. Do not fix paths by committing `dist/` or generated readers.

If `npm ci` fails, verify Node 24 or newer and that `package.json` and
`package-lock.json` agree. For an audit failure, review the advisory and update
the affected dependency before publishing. Do not bypass the failing check.

To roll back, revert the faulty source commit in a pull request or on `main`,
then let the workflow rebuild and redeploy. If source is already correct and
only deployment failed, rerun the workflow on the current `main`. A failed check
does not upload a replacement artifact or deploy the failed build.

## Hosting limits

All deployed content is public. Pages cannot provide the former editor or write
API. GitHub Pages controls HTTP response headers; this repository does not set
custom security headers there. Article fonts load from Google Fonts. See
[the security policy](../SECURITY.md) for the trust model and reporting channel.

For another static host, upload the **contents** of `dist/` after building with
that host's origin and base. The host must serve directory `index.html` files.
Custom domains are not configured by this repository's Pages workflow.

Implementation references: [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
and [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
