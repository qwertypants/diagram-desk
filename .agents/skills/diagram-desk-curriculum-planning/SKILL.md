---
name: diagram-desk-curriculum-planning
description: Use when organizing Diagram Desk lessons into learning paths, identifying missing prerequisites or reader capabilities, or prioritizing future lesson topics against existing coverage.
---

# Plan a Diagram Desk curriculum

Plan what readers should learn and in what order before commissioning new lessons. This skill produces a reviewable learning map and a short candidate backlog; it does not create articles. Follow the collection scope and editorial criteria in `docs/editorial-standards.md`.

## Map what exists

1. Inspect the current library and dirty state. Read article and companion content, catalog metadata, related links, and diagrams for relevant lessons. Use titles and tags to find candidates, then verify from the actual explanations.
2. Describe each lesson by its reader problem, decision or mechanism, assumed knowledge, failure it teaches, and capability the reader gains.
3. Connect prerequisites only when a later lesson relies on knowledge the earlier lesson supplies. Explain each edge in plain language. Mark uncertain dependencies as hypotheses.
4. Identify gaps as reader decisions or operational capabilities, not broad subject labels. Check whether an existing lesson already teaches that decision under different terminology.

## Propose a sequence

Create one or more paths for concrete readers, such as an engineer building a first tool loop or an operator improving a deployed agent. For each path, state its entry knowledge, intended end capability, ordering rationale, and where readers can branch or skip material.

Use [the curriculum brief](references/curriculum-brief.md). Propose at most five new lesson candidates. Prefer refreshing, clarifying prerequisites, or linking existing lessons when that gives readers a better path than another article. Each candidate needs a distinct takeaway and nearest existing lesson. A curriculum recommendation is not evidence, topic approval, or publication authorization.

## Rank candidates

Rank by reader need, evidence availability, and contribution to an identified path. For every proposal include the decision the reader will make, prerequisite slugs, overlap analysis, a diagram argument, candidate primary evidence, and an observable learning check. If the distinction from existing lessons is weak, merge the candidate into the maintenance queue instead of commissioning it.

Do not infer topical coverage from a diagram title. Do not invent evidence or claim a gap because a popular term is absent. Label unknowns and ask focused questions only when the audience or intended outcome cannot be inferred from the request.

## Handoff

Send approved candidates to `diagram-from-discussion` for commissioning and research. Keep the curriculum brief local unless durable documentation is requested. Do not change navigation, article ordering, URLs, or lesson content as part of planning.

## Return

Report the audience, paths and prerequisites, existing coverage consulted, no more than five ranked candidates, overlap decisions, evidence availability, and unresolved assumptions.
