---
name: diagram-from-discussion
description: Use when someone wants to discuss an issue and author or substantially revise a Diagram Desk lesson with a native Archify diagram.
---

# Diagram from Discussion

Turn an issue, supplied brief, or bounded batch assignment into native Archify
diagrams and MDX lessons in this static repository. The former in-browser editor and save API are
retired. Follow the repository workflow in [CONTRIBUTING.md](../../../CONTRIBUTING.md)
and the publication standard in [Editorial standards](../../../docs/editorial-standards.md).

## Read before you start

Read these in order. Do not draft until every item is available.

1. [Editorial standards](../../../docs/editorial-standards.md): scope, content
   contract, source policy, review roles, and freshness.
2. [Writing lessons and diagram companions](../../../docs/writing-lessons.md):
   the two reading experiences and the human review checklist.
3. `src/content.config.ts`: the frontmatter schema.
4. One recent article, its companion, and its `catalog/diagrams/<slug>.json`.
5. [The bundled Archify skill](../../../vendor/archify/SKILL.md). Use this
   vendored version even if another Archify skill is installed globally. Run
   the CLI as `node vendor/archify/bin/archify.mjs` from the repository root.
6. [Review rubric](references/review-rubric.md): the blocking checks for stages
   4 and 5.

If a file or the vendored CLI is missing, stop and report the path. Do not
substitute another version or a retired API.

## Stage 0 — Commission

Choose the entry path from the user's request:

- **Discussion:** invite a description of the issue and ask one focused question
  at a time, only where an answer affects accuracy or scope.
- **Supplied brief:** read it and the repository first. Reuse decisions already
  present; ask only for missing information that blocks research or would change
  the diagram's meaning. Make reversible assumptions explicit rather than
  restarting discovery.
- **Batch:** create a [batch manifest](references/batch-manifest.md) before
  researching individual lessons. Give each proposed article a distinct reader
  decision, example, diagram argument, and nearest existing lesson. Review
  overlap across the batch and against the library. Do not repeat the same
  discovery interview for every entry when the brief already answers it.
- **Scheduled assignment:** follow the supplied assignment, schedule, and
  authorization. Do not invent eligibility rules or timing. If the topic or
  publication authorization is missing, prepare only the authorized local work
  and report the unresolved gate.

For every lesson, complete the commissioning template at
[references/commissioning-brief.md](references/commissioning-brief.md).

**Gate:** each brief names the reader problem, promised takeaway, at least three
candidate primary sources, and nearest existing article. Stop that lesson if it
duplicates existing coverage, has no primary evidence, or reduces to "this is
important." A failed lesson does not silently invalidate unrelated batch items;
record it and continue only where the assignment permits.

For a substantial revision, read the existing article, companion, and diagram
first, and state what will change and what must be preserved.

## Stage 1 — Research

Read the source policy in the editorial standards. Build a claim ledger with
[the claim-ledger template](references/claim-ledger.md) for every claim a reader
could reasonably challenge: numbers, comparisons, security properties,
benchmark results, protocol behavior, and claims about what a vendor or model
does.

Prefer primary sources. Record the date and version for anything that changes.
For benchmark claims, record the model, harness, task set, date, and metric.
For contested claims, find at least one limiting or dissenting source.

**Gate:** every nontrivial claim has a source; no number, date, or version is
invented; fast-moving claims are dated. Do not draft until this gate passes.

## Stage 2 — Model the explanation

Write, in this order:

- one-sentence thesis;
- what the reader should be able to decide or explain afterward;
- one-sentence argument for the diagram;
- the diagram's reading order;
- a short article outline with one concrete example, one failure, one tradeoff,
  and one verification method;
- a separate companion outline.

**Gate:** the diagram can carry its stated argument without the prose doing the
work. If it cannot, revise the diagram or the thesis before drafting. Give the
user a short plain-language summary and correct it if they point out a mismatch.

## Stage 3 — Draft

Add the native JSON, catalog entry, article, and companion together. Use the
frontmatter and embed format in `README.md`. Keep labels, direction, ownership,
and failure paths faithful to the discussion and the diagram.

- Do not invent causes, steps, relationships, numbers, or quotes.
- Keep one concrete example; use a hypothetical scenario only when it clarifies
  the mechanism, and label it as illustrative.
- End the article with `## Sources`, listing the substantive sources and dates.
  Use an explicit "As of <Month Year>" sentence for fast-moving claims.
- Write the companion separately. It must stand alone, name the main caveat,
  and link to the article for depth.
- Do not set `reviewed` or `reviewBy` until an independent review has happened.

**Gate:** the article satisfies the content contract in the editorial standards,
and every label in the prose matches the diagram JSON. For a batch, also check
that each entry in the manifest has its own reader decision and that no shared
example, outline, or companion was copied across entries.

## Stage 4 — Self-review

Run the [review rubric](references/review-rubric.md) against the draft, companion,
and diagram. Check the claims against the ledger, not against memory. Check the
related links and the topic.

Run `npm test`. It includes the editorial check for Sources, review metadata,
placeholders, and related links.

**Gate:** every blocking self-review item passes. Fix the source or narrow the
claim rather than adding unsupported confidence.

## Stage 5 — Independent review

Ask a reviewer who did not write the draft to check:

- the mechanism, interfaces, failure behavior, and tradeoffs;
- the reader path and whether the article earns its length;
- every number, date, label, and source link;
- the diagram's fidelity to the article.

Reviews separate **blocking** findings from **suggestions**. Resolve or
explicitly accept each blocking finding with a reason. For a batch, ask the
reviewer to compare lessons for overlap, distinct takeaways, prerequisites, and
consistent links between related topics. If no independent reviewer is
available, say so; do not claim the article is reviewed and do not set
`reviewed` or `reviewBy`.

## Stage 6 — Verify

1. Run `npm test`.
2. Run `npm run check:catalog` when the diagram changed.
3. Start or rebuild `npm run preview`, open the actual article, companion, and
   reader, and inspect the rendered diagram.
4. Check keyboard access, text alternatives, desktop and phone widths, and the
   deployment path when publishing to GitHub Pages, such as
   `http://localhost:4321/diagram-desk/`.
5. Run `npm run test:browser -- <site-url>/` for navigation and reader controls.

Do not claim a live publication until the deployment succeeds and the public URL
has been checked.

## Stage 7 — Publish and maintain

Show the rendered draft and ask whether it represents the issue correctly. Apply
requested changes and preview again. Use any supplied approval and publication boundaries. Get approval when the
requested action would exceed them, and always before an unrequested commit or
publication.

Commit the article, companion, diagram JSON, and catalog entry together. Preserve
existing legacy IDs and unrelated source work. Update `related` links and the
topic when the taxonomy changes. Set `reviewed` and `reviewBy` only after a full
review, using the freshness interval in the editorial standards.

## Non-negotiables

- Do not draft before the research gate passes.
- Do not invent facts, causes, relationships, numbers, dates, or quotes.
- Do not use a uniform template or a rigid word count. Keep the structure that
  helps this reader understand this topic.
- Do not copy an existing article's structure as a substitute for thinking about
  this one.
- Do not call a retired API or write a SQLite database.
- Do not claim publication, review, or verification that did not happen.
- Preserve unrelated work in the repository.

## Return

Report the article title and slug, the files changed, the sources used, the
verification performed, the review status, and whether the link is a local
preview or a published page. URLs must include the configured hosting base.
