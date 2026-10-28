# Diagram Desk

A static technical learning library about software and AI systems. Twenty authored articles pair explanations and engineering trade-offs with interactive Archify diagrams. The original 18 diagram IDs resolve to their canonical articles; two IDs referred to the same evaluation lesson.

[Read the library](https://qwertypants.github.io/diagram-desk/) · [Source and issues](https://github.com/qwertypants/diagram-desk) · [Contribute](CONTRIBUTING.md) · [Deploy your own copy](docs/deployment.md)

## Run locally

Requires Node.js 24 or newer and npm.

```sh
git clone https://github.com/qwertypants/diagram-desk.git
cd diagram-desk
npm ci
npm run dev
```

Open the URL printed by Astro (normally <http://localhost:4321/>). To inspect the deployable output:

```sh
npm run check
npm run build
npm run preview
```

Run `npm test` for the complete automated check. See the [architecture guide](docs/architecture.md) for the source layout and build process.

`npm run dev` and `npm run build` render the version controlled Archify JSON in `catalog/diagrams/` into standalone readers under `public/diagrams/`. Astro then serves or generates the article, topic, index, and legacy URL pages. The production output is `dist/`; it can be hosted as static files without Node, SQLite, an API, or a CMS.

## Read and author

Browse by article or topic. Each lesson explains the engineering problem, walks through its diagram, and records decisions and failure modes. The reader is embedded in the article. Its full-view link opens a short standalone companion with the interactive diagram, a link back to the full lesson, and a canvas-only view.

### Create a lesson with your coding agent

After local setup, open your coding agent in the cloned repository and invoke the included [diagram-from-discussion skill](.agents/skills/diagram-from-discussion/SKILL.md). In Codex, try:

```text
$diagram-from-discussion Help me explain how our support team handles
an escalated ticket, from the initial report through resolution.
```

The agent asks focused questions, drafts the native diagram and MDX lesson, runs checks, and opens a local preview for your review. It asks for approval before committing or publishing.

The workflow loads the [bundled Archify skill](vendor/archify/SKILL.md) and uses the matching CLI, schemas, and examples in `vendor/archify/`. No separate global Archify installation is required.

If your agent does not discover the skill, paste this instead:

```text
Read and follow .agents/skills/diagram-from-discussion/SKILL.md,
including its bundled Archify skill dependency. Help me turn an issue
into a diagram and lesson. Start by asking me about the issue.
```

### Author a lesson manually

To add an article:

1. Add an Archify JSON definition at `catalog/diagrams/<slug>.json` and a matching entry in `catalog/index.json`. Use an existing definition as a starting point and keep its native diagram type consistent with `diagram_type`.
2. Add `src/content/articles/<slug>.mdx` with the fields validated by `src/content.config.ts`: `title`, `description`, `pubDate`, `topic`, `tags`, `difficulty`, `objectives`, `takeaways`, `diagram`, and `legacyIds`. `related`, `reviewed`, and `reviewBy` are optional. Set `diagram` to the catalog slug.
3. Import `DiagramEmbed` from `../../components/DiagramEmbed.astro` in the MDX body. After the problem and a short reading cue, embed the primary diagram with `<DiagramEmbed slug="<slug>" title="<article title>" />`. You can embed another existing catalog diagram later in the article when a second view helps explain the concept. End the article with a `## Sources` section that lists the substantive sources and dates.
4. Add `src/content/companions/<slug>.mdx` with `title`, `description`, and `diagram` frontmatter. Write a short standalone explanation and import `DiagramEmbed` with `companion={true}`, a topic-specific `heading`, and a reading `cue`. See [Editorial standards](docs/editorial-standards.md) and [Writing lessons and diagram companions](docs/writing-lessons.md).
5. Run `npm test`, then inspect the article, companion, and reader at desktop and mobile widths. `npm run check:catalog` adds native diagram acceptance when the chart changes.

The old in-browser **New diagram**, edit, save, and delete workflow has been removed. Edit MDX and JSON in the repository and commit them together. Existing `/diagrams/<UUID>/` and `/diagrams/<UUID>/edit/` links lead to the corresponding article; there is no editing API behind the latter URL.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build Archify readers and start Astro development server |
| `npm run check` | Check migration coverage, editorial standards, and run `astro check` |
| `npm run check:migration` | Check article/companion relationships and all 18 legacy ID mappings |
| `npm run check:editorial` | Check `## Sources` sections, review metadata, and related links |
| `npm run build` | Build readers and static Astro site into `dist/` |
| `npm run preview` | Serve an existing static build locally |
| `npm test` | Check content and types, build the site, and verify static article, companion, reader, and legacy routes |
| `npm run test:browser -- <site-url>/` | Check navigation, all readers, zoom, dark mode, and legacy links at desktop and phone widths against a running site |

`npm run check:catalog` is a separate native diagram acceptance tool. It requires local Chrome or Chromium and writes evidence under `.archify/`; it is useful when changing a catalog diagram, but it is not part of the standard CI check.

For the browser walkthrough, install its browser once with `npx playwright install chromium`, start `npm run preview` in another terminal, then run `npm run test:browser -- http://localhost:4321/`. Screenshots are written under ignored `.archify/pages-check/`.


## GitHub Pages

The [CI and Pages workflow](.github/workflows/ci.yml) checks the root build and the repository-prefixed build. Successful pushes to `main` publish the verified `dist/` artifact to GitHub Pages. Pull requests run checks without deploying.

Forks derive their GitHub Pages origin and path from the repository owner and name. Enable **Settings → Pages → Source → GitHub Actions** before publishing. The [deployment guide](docs/deployment.md) covers setup, local previews, troubleshooting, and rollback.

## Architecture and limits

Astro content collections validate the MDX article metadata. The catalog and native Archify JSON are version controlled. The build invokes vendored Archify and publishes each interactive reader as static HTML, embedded by the corresponding article. Reader behavior is provided by the generated Archify page; article pages stay mostly static.

The former local SQLite library and CRUD editor are no longer available. Content changes require a repository edit and rebuild. Existing API consumers need to migrate to static article and reader URLs. The [migration audit](docs/archify-migration.md) records how the original topics were preserved.

The site has no user accounts or private content storage. Treat article text, JSON, and links as public deployment assets. See [SECURITY.md](SECURITY.md).

## License

The application, articles, and diagram sources are [MIT licensed](LICENSE). Archify is vendored under its [MIT license](vendor/archify/LICENSE), with [upstream third-party notices](vendor/archify/THIRD_PARTY_NOTICES.md). Referenced publications and external assets retain their own licenses.
