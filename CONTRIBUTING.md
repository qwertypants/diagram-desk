# Contributing to Diagram Desk

Contributions to articles, diagrams, code, and documentation are welcome. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are licensed under the [MIT license](LICENSE).

## Set up

Use Node.js 24 or newer. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Astro (normally <http://localhost:4321/>).

## Add or revise a lesson

For guided authoring, invoke `diagram-from-discussion` from this repository. Its instructions are in [`.agents/skills/diagram-from-discussion/SKILL.md`](.agents/skills/diagram-from-discussion/SKILL.md). The workflow explicitly loads the [bundled Archify skill](vendor/archify/SKILL.md) and uses its matching CLI, schemas, and examples under `vendor/archify/`. No separate global Archify skill installation is required. If your agent does not discover the discussion skill automatically, ask it to read and follow that file.

Read [Editorial standards](docs/editorial-standards.md) for the publication's
scope, content contract, source policy, review roles, and freshness rules. Read
[Writing lessons and diagram companions](docs/writing-lessons.md) for the two
reading experiences and human review checklist. Each diagram needs a full
article and a separately written companion in `src/content/companions/`.

Articles live in `src/content/articles/` as MDX. Their frontmatter is validated
by `src/content.config.ts`; use a nearby article as a model. Keep objectives,
explanation, diagram, failure modes, and takeaways connected so the visual
teaches a specific idea. End every article with a `## Sources` section and list
the substantive sources with dates. Set `reviewed` and `reviewBy` when an
article has had a full review; the editorial check warns when a review is
overdue.

Native Archify JSON lives in `catalog/diagrams/` and is indexed by `catalog/index.json`. Set the article's `diagram` field to the matching catalog slug. The build renders that JSON into `public/diagrams/<slug>/reader.html`. Check the reader at desktop and mobile widths, including keyboard access and readable context around the frame. Add meaningful text alternatives in the article for relationships conveyed by the diagram.

The former browser editor and SQLite API have been removed. Edit the source files and commit the article, companion, and any diagram changes together. Existing legacy IDs are mapped to canonical articles; preserve that mapping when changing a migrated lesson.

## Before a pull request

```sh
npm test
npm audit --audit-level=high
```

`npm test` includes the editorial check, which requires a `## Sources` section and
valid review metadata. For changes to a page or diagram, inspect the built site with
`npm run preview` on desktop and mobile. `npm run check:catalog` is available for
native diagram acceptance and needs local Chrome or Chromium. It is separate from
the standard checks. CI runs content, editorial, and type checks, a dependency
audit, and verified production builds on Node 24 at both root and repository paths.

Use `withBase` from `src/lib/urls.ts` for application paths in templates. Write ordinary source links in MDX; the build adds the visible ↗ and accessible new-window notice to external links. Keep in-page anchors unchanged. For hosting changes, follow the repository-path preview in [the deployment guide](docs/deployment.md), including the static URL checker. The [architecture guide](docs/architecture.md) explains the build boundaries.

For offline storage, installation controls, icons, or build pipeline changes,
follow [Maintain the installable offline library](docs/pwa.md). Check the built
manifest and complete library cache at both root and repository paths, then
inspect browser installation and offline reading. Rebuild the worker after all
HTML decoration so its integrity hashes describe the final published bytes.

Keep task lists and planning notes local in `tasks/`, `docs/plans/`, or `docs/superpowers/`; these directories are ignored. Commit durable documentation and relevant source changes. Do not commit `dist/`, generated `public/diagrams/`, local databases, `.env` files, or `.archify/` evidence.

Make each pull request a coherent change. Explain what changed, why, and any verification you could not perform. Update the README when setup or authoring steps change.

## Reporting issues

For a bug, include the article URL or catalog slug, what you expected, what happened, and steps to reproduce. For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
