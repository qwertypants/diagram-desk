---
name: diagram-desk-library-maintenance
description: Use when auditing Diagram Desk lessons for stale evidence, overdue or missing review metadata, broken related links, duplicate coverage, or when planning a library refresh.
---

# Maintain the Diagram Desk library

Use this skill to decide which existing lessons need attention and why. Follow `docs/editorial-standards.md` for source quality and freshness policy, and `docs/writing-lessons.md` for article and companion expectations. For any substantive refresh, use the `diagram-from-discussion` skill and update its article, companion, diagram, and catalog entry together.

## Inventory

1. Inspect the current branch, dirty files, and library. Read article frontmatter and body, companions, catalog metadata, related links, and native diagrams for every candidate. Titles and tags alone do not establish coverage.
2. Run `npm run check:editorial` and `npm run check:catalog` when relevant. Treat checker output as signals, not an editorial verdict.
3. Build a local queue using [the maintenance report](references/maintenance-report.md). Include articles with absent review metadata; missing dates do not make them current.
4. Check source links and claims that can change: models, protocols, benchmarks, security recommendations, and product behavior. Search for primary sources and record what current evidence does and does not support.
5. Compare neighboring lessons by reader decision and mechanism. Similar vocabulary is not proof of duplication. Check whether the lesson has useful prerequisites, related links, and a clear distinction from adjacent coverage.

## Prioritize and act

Rank issues by reader harm and urgency: materially false or unsafe guidance first, then broken evidence or links that block verification, overdue fast-moving claims, overdue durable concepts, missing review dates, and optional structure improvements. Explain each ranking with evidence. Do not imply that a due date proves a claim is stale.

For each item, recommend one disposition: refresh; narrow unsupported claims; mark historical with a date; retain and explain why; or investigate overlap and propose consolidation with explicit route/legacy-ID impact. Similarity alone never authorizes deleting a published lesson or redirecting its route.

Keep the first pass read-only. Do not change `reviewed` or `reviewBy` while merely inventorying. Set both only after the full review required by the editorial standard. Do not fabricate review dates from publication dates or source dates. If the user authorizes a refresh, scope the changes, preserve legacy IDs and unrelated work, run the editorial checks and appropriate site verification, and report the review state accurately.

## Stop conditions

- If an external source is unavailable, mark the claim unverified. Do not report it as false solely because its link fails.
- If a moving claim has no current primary evidence, recommend narrowing or historical labeling rather than asserting a replacement fact from memory.
- If consolidation could change a public URL or legacy redirect, document the impact and preserve routes unless the user authorizes route changes.
- If an article has no review metadata, put it in the queue as “review state unknown.”

## Return

Report the inventory date and branch, checks run, prioritized queue, evidence and uncertainty for each item, proposed disposition, and any authorized files changed. Keep the report local under `tasks/` unless the user asks for durable public documentation.
