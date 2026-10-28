# Review rubric

Use this for the author's self-review and again for an independent review. Mark
each item **pass**, **blocking**, or **suggestion**. A blocking finding must be
fixed or explicitly accepted with a reason.

## Thesis and reader

- [ ] The opening names the problem or decision, not just the topic.
- [ ] The article states a takeaway the reader can act on.
- [ ] The reader can explain what they would do differently.
- [ ] The article says when a simpler approach is enough.
- [ ] Nothing is included only because a template or an existing article had it.

## Evidence

- [ ] Every substantive claim has a source in the ledger.
- [ ] Numbers, dates, versions, and labels match the sources.
- [ ] Fast-moving claims include an "As of <Month Year>" line.
- [ ] Benchmark claims name the model, harness, task set, date, and metric.
- [ ] Vendor claims are labeled, and contested claims include a counterpoint.
- [ ] `## Sources` lists the substantive sources with dates.
- [ ] Research and benchmark articles have at least two dated sources.

## Technical content

- [ ] The mechanism is explained, not only described.
- [ ] The control boundary between model behavior and application guarantees is clear.
- [ ] One concrete failure and its recovery, stop, or escalation path are explained.
- [ ] One tradeoff is quantified or made concrete.
- [ ] A verification method is included: eval, trace, test, or acceptance criterion.
- [ ] The article is accurate about permissions, persistence, and idempotency.

## Diagram

- [ ] The diagram has one argument and an explicit reading order.
- [ ] Every relationship the chart carries is explained in the prose.
- [ ] Labels, direction, ownership, and failure paths match the JSON.
- [ ] A reader who cannot inspect the canvas gets a useful text description.
- [ ] The chart does not imply a benchmark, guarantee, or outcome the sources do not support.

## Companion

- [ ] It makes sense when opened directly, without the article.
- [ ] It answers the central question and names the main caveat.
- [ ] It is written separately, not copied from the article.
- [ ] It links to the article for depth.

## Accessibility and verification

- [ ] Heading order and link text are meaningful.
- [ ] External links show `↗` and announce the new window.
- [ ] Keyboard access and reader controls work.
- [ ] Desktop and phone layouts are readable.
- [ ] The root path and the deployment base path both work.
- [ ] `npm test` passes, and `npm run check:catalog` passes when the diagram changed.

## Stop conditions

Do not approve the article if a blocking finding remains, if a number or claim
cannot be traced, or if the independent review did not happen. If review is
incomplete, say so and leave `reviewed` and `reviewBy` unset.
