# Editorial standards

This is the publication standard for Diagram Desk. It complements [Writing
lessons and diagram companions](writing-lessons.md), which describes the two
reading experiences. Read both before drafting a lesson.

## What this publication is for

Diagram Desk is a visual engineering library for people building and operating
agentic systems. **Agentic engineering** here means:

- designing the loop, tools, context, memory, and verification around a model;
- operating those systems: evaluation, observability, security, cost, and recovery;
- using coding agents to build software with review and verification.

The reader is a professional engineer who knows basic programming and is new to
the specific topic. Do not assume familiarity with a vendor, framework,
benchmark, or deployment model.

An article should teach a decision or mechanism that a reader can apply. It is
not a product announcement, a framework tour, or a summary of a diagram.

## Commission before writing

Write a short brief before drafting:

- **Reader problem:** what decision or failure is the reader facing?
- **Why now:** what changed, or what is commonly misunderstood?
- **Promised takeaway:** what should the reader be able to do or explain?
- **Non-goals:** what is deliberately out of scope?
- **Primary sources:** at least three candidates, with dates.
- **Nearest existing article:** why this is not a duplicate.
- **Review owner:** who will check the claims and the reading path?

Do not start drafting when the brief has no primary evidence, duplicates an
existing article, or reduces to "this topic is important." A diagram is not a
substitute for a thesis.

## Content contract

Every new or substantially revised article must:

1. **Teach a decision or mechanism**, not merely describe a system.
2. **Name the actors, state, and control boundary** — what the model decides,
   and what application code guarantees.
3. **Show one concrete failure** and the recovery, stop, or escalation condition.
4. **Separate model behavior from application guarantees** — authorization,
   persistence, idempotency, and permissions belong in code.
5. **Quantify one tradeoff** where possible: tokens, latency, cost, context
   budget, pass rate, or human-review load.
6. **Include a verification method** — an eval, trace check, test, or
   acceptance criterion.
7. **Say when a simpler approach wins.**
8. **Cite at least two primary sources** for nontrivial claims in new or
   substantially revised articles, and date fast-moving claims. Existing
   articles list their current sources and should add a second when refreshed.
9. **Include a counterpoint** for contested topics: multi-agent systems,
   autonomy, framework choice, or benchmark claims.
10. **Give the diagram one argument** and an explicit reading order. Prose must
    explain what the chart cannot show.

Keep one concrete example through the important steps. Use a hypothetical
scenario when it makes the mechanism clearer, and label it as illustrative.

## Evidence and sources

Prefer primary evidence over summaries.

| Tier | Use for | Examples |
| --- | --- | --- |
| **1 — Primary** | Specifications, standards, peer-reviewed work, official engineering posts with methods, benchmark maintainers | MCP and A2A specifications, OWASP, OpenTelemetry GenAI, Anthropic, OpenAI, Google, METR, τ³-bench |
| **2 — Practitioner** | Reproducible experience reports with named authors and disclosed methods | Cognition, LangChain, Simon Willison, Martin Fowler |
| **3 — Discovery only** | News, listicles, SEO summaries | Use to find Tier 1 sources, never as the only support for a claim |

Rules:

- Link to the exact page, section, or version that supports the claim.
- State the date for anything that changes: models, benchmarks, protocols, and
  prices. Use an explicit "As of October 2026" sentence for fast-moving claims.
- Label vendor claims as vendor claims, and name the incentive when it matters.
- For benchmark claims, include the model, harness, task set, date, and metric.
  Distinguish `pass@1` from `pass^k`; a single success is not reliability.
- For contested claims, cite at least one limiting or dissenting source.
- Fast-moving claims older than 12 months need a historical label or a refresh.
- Do not invent numbers, dates, versions, or quotes. If a source cannot be
  checked, say so and narrow the claim.

Every article ends with a `## Sources` section. List the sources used for the
article's substantive claims, not every link in the prose. Each entry should
identify the publisher, title, and date. A research or benchmark article needs
at least two dated sources, preferably the report and the underlying paper.

## Diagrams and companions

The diagram is part of the argument. Before drafting, write its one-sentence
claim and the order a reader should follow. If the chart cannot support that
claim without prose, revise the chart or the thesis.

- Every relationship conveyed by the diagram must be explained in the article,
  including direction, ownership, and failure paths.
- Add a text description for readers who cannot inspect the canvas.
- Keep labels faithful to the source and consistent between the article,
  companion, and JSON.
- The companion is a separate short explanation for someone who opens the
  diagram directly. It should answer the central question, define enough
  context to stand alone, give a reading cue, and name the main caveat. Aim for
  150–300 words; it is not a truncated article.
- Do not copy article sections into the companion.

## Review roles

Small teams may combine roles, but each pass must be explicit.

- **Author:** drafts the article, companion, and diagram, and completes the
  self-review.
- **Technical reviewer:** checks the mechanism, interfaces, failure behavior,
  and tradeoffs.
- **Editorial reviewer:** checks the reader path, prose, and whether the article
  earns its length.
- **Fact-checker:** checks claims, numbers, dates, labels, and source links.
- **Accessibility and browser verifier:** checks keyboard access, text
  alternatives, desktop and mobile layouts, and the deployment base path.

At least one reviewer must not have written the draft. Reviews separate
**blocking** findings from **suggestions**; a blocking finding must be resolved
or explicitly accepted with a reason.

## Definition of done

- [ ] The commissioning brief is complete and the article is not a duplicate.
- [ ] The thesis, reader takeaway, and non-goals are stated.
- [ ] The content contract is satisfied.
- [ ] Every nontrivial claim has a source; research and benchmark claims are dated.
- [ ] `## Sources` lists the substantive sources with dates.
- [ ] The article, companion, and diagram agree on labels and relationships.
- [ ] A reviewer who did not write the draft has checked the claims and reading path.
- [ ] `npm test` passes, including the editorial check.
- [ ] `npm run check:catalog` passes when the diagram changed.
- [ ] The built article, companion, and reader work at desktop and mobile widths,
      at the root path and under `/diagram-desk/` when publishing to GitHub Pages.
- [ ] `reviewed` and `reviewBy` are set when the article has had a full review.

## Freshness

Agentic engineering changes quickly. Set `reviewed` to the date of the last full
review and `reviewBy` to the next review date. Use six months for fast-moving
topics such as models, benchmarks, protocols, pricing, and security guidance;
twelve months is reasonable for durable architecture concepts.

The editorial check warns when `reviewBy` has passed. Refresh the article,
narrow its claims, or label it historical. Do not silently keep a stale claim.

Existing articles that predate this standard list their sources but may not have
review metadata. That absence does not imply review. Add `reviewed` and
`reviewBy` when an article is next substantively revised.
