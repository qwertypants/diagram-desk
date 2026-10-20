# Writing lessons and diagram companions

Write two complementary reading experiences for each diagram. The main article
teaches the topic in depth; the companion is a short standalone explanation for
someone who opens the diagram directly. Both should make sense without requiring
the reader to operate the canvas.

## Where to write

- Main lesson: `src/content/articles/<slug>.mdx`
- Diagram companion: `src/content/companions/<slug>.mdx`
- Diagram source: `catalog/diagrams/<slug>.json`

Use the same slug for the article, companion, and diagram. The article's
frontmatter is checked against the article schema in `src/content.config.ts`.
Companion frontmatter has exactly `title`, `description`, and `diagram`; its
`diagram` value is the matching diagram slug. Import `DiagramEmbed` from
`../../components/DiagramEmbed.astro` in a companion and render it with
`companion={true}`, a useful `heading`, and a short `cue` that tells readers
where to begin and what relationship to follow.

The published paths are `/articles/<slug>/` for the full lesson,
`/diagrams/<slug>/` for the companion page, and
`/diagrams/<slug>/reader.html` for the canvas-only reader. Link the article to
its companion and the companion back to the article. The companion layout
provides the canvas-only link. Existing UUID diagram URLs remain redirects to
their corresponding article.

## Shape the two explanations

Assume the reader knows basic programming and is new to the specific topic.
Give the lesson a clear question or situation and a direct answer, then develop
one concrete example through the important steps and decisions. Introduce the
diagram with its actual entry point and a reading order. Explain why the
important transitions and boundaries matter, describe a realistic failure or
limitation, and say when a simpler approach may be enough. Use reliable sources
for claims that need support.

Write the companion separately rather than copying an introduction from the
article. It should answer the diagram's central question, define enough context
to stand alone, give a reading cue beside the diagram, and explain one or two
important relationships plus the main caveat. Link to the article for more
depth. A few concepts may need a concise explanation in both places; avoid
duplicating whole sections.

## Human review checklist

For each article and companion, ask:

- Can a reader say what problem this addresses after the opening?
- Does the example explain something beyond the diagram's labels?
- Can the reader follow the chart in an intentional order?
- Does the article explain why the important decisions exist?
- Can a reader name a limitation and when this approach is useful?
- Does the companion make sense when opened directly?
- Are its claims, labels, and sources accurate and consistent with the full article?
- Does every external link show a visible `↗`, announce “opens in a new window” to assistive technology, and open separately when activated?
- Would removing any paragraph improve the reading experience?

Use length guidance as a planning aid only. A main article may take a few minutes
to read, and a companion is usually much shorter; neither has a rigid word-count
gate. Keep the structure and length that help a reader understand that topic.

## Check the result

Run `npm test` to check content and types, build the static site, and verify its
routes and generated links. The build decorates external HTTP(S) links that lead
to another origin: they open in a new tab with `noopener noreferrer`, display
only `↗`, and expose the new-window explanation to screen readers. Internal
links, email links, and downloads keep their existing behavior.

For browser navigation and canvas interaction, serve the build and run
`npm run test:browser -- <site-url>/`. Check article-to-companion-to-article
navigation, the canvas-only reader, and article/topic and legacy routes at
desktop and phone sizes. For GitHub Pages, include the repository prefix in the
URL, such as `http://localhost:4321/diagram-desk/`.
