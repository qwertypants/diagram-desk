# Archify migration audit

The baseline contained 13 SQLite records and 12 distinct topics. Original
source, IDs, and timestamps are retained in `catalog/legacy.json`. The catalog
maps each old ID and SHA-256 digest to a checked native candidate. The duplicate
evaluation records remain distinct records backed by the same lesson candidate.

These diagrams describe educational designs. They are not assertions about
Diagram Desk's implementation or evidence that any example is deployed.

| Original topic | Preserved meaning | Representation and correction |
| --- | --- | --- |
| Agentic AI systems with tools | Context loading, model/tool decision, four tool capabilities, feedback, guardrails, tracing | Architecture with request, tool-loop, and response reading steps. Separate validation from tool authorization in the explanation. |
| Async AI processing | Three workers, queue, job state, results, retry queue, dead-letter queue, polling, telemetry | Architecture with explicit worker-owned result writes. Explain the API/database/queue dual-write gap and shared retry policy. |
| Autonomous Agent: Plan, Act, Check, and Stop | Clarification, planning, tool action, observed feedback, checkpoint/resume, completion, limit stop | Workflow lanes separate planning, observation, and terminal choices. |
| Collaborative Comments and Version History | Current content, merge/broadcast, committed history, comment-time version, anchors, moved/deleted text, separate stores | Architecture with separate reading steps for live edits, history, and anchors. Deleted anchors remain an explicit outcome in the lesson. |
| Effective Agents: Design Principles and Practice | Simplicity, transparency, tool design/testing, feedback, human checkpoints, support/coding/other fit criteria | Workflow connects design principles to concrete application choices; full fit criteria appear in the reading path. |
| Full AI product architecture | Gateway, authentication, application state/cache/jobs, orchestration, retrieval, tools, model gateway, three providers, workers, telemetry, evaluation | Architecture makes authentication a prerequisite to protected application access. The reading path distinguishes application, AI execution, tools, and background evidence. |
| Production RAG System | Authentication/rate limits, query embedding, vector retrieval, reranking/filtering, prompt, model, validation, ingestion, traces | Dataflow separates online serving from ingestion. An explicit retained-query input supplies original query text to the prompt builder; it is the same request, not a second user request. |
| Stream AI in chat | Five participants, two illustrated chunks, progressive display, completion, internal validation, final metadata | Sequence preserves message order and returns. Internal validation is a note on the complete response, because native sequences do not support self-loops. SSE and WebSocket remain alternatives. |
| When a Job Completes While It Moves | Dispatcher transaction/outbox, local offline completion/note, durable queued key/version, cursor catch-up, server checks, completion audit, retained reassignment, review and closure | Workflow clarifies that completion acceptance and reassignment retention are compatible field-level outcomes. It retains the intended final result: completion stands and stale dispatch is closed. |
| Workflow Patterns: Five Ways to Compose LLM Calls | Chaining/gate, routing/specialists, sectioning, repeated voting, dynamic workers/synthesis, evaluator refinement | Six lanes keep the five patterns separate; parallelization has independent sectioning and voting lanes. The patterns are not connected into a fictitious single pipeline. |
| Workflows or Agents? Choosing the Right Level of Complexity | Single-call sufficiency, predictable/code-led steps, model-directed work, predictability/flexibility trade-off, outcome comparison, simplification loop | Workflow exposes the decision gates. The reading path states what evidence justifies added complexity. |
| AI System with evaluation, both records | Serving, response/trace sampling, golden cases, three grading methods, scores/dashboard, regression decision, improvement loop, deployment | Dataflow distinguishes serving observations from offline grading and release control. Redaction, judge calibration, and segment-level failures are explicit educational notes. |

## New scenarios

The five additions teach permissioned execution, evidence sufficiency, bounded
research delegation, trace-driven evaluation, and durable approval/recovery.
They use workflow, dataflow, architecture, sequence, and lifecycle modes
respectively. Each supplies a problem, objectives, a reading path, decisions,
failure modes, takeaways, and primary references.

Sources are linked within each lesson. The source references establish the
individual patterns; the combined layouts and domain policies are illustrative.
There are no invented performance measurements or claimed production outcomes.

## Acceptance and recovery

`catalog/acceptance.json` binds every final candidate digest to passing native
validation, delivery, artifact, and browser gates. Detailed generated receipts
and visual captures live under `.archify/`, outside version control. The browser
walkthrough also checks the integrated shell, offline behavior, and mobile
containment rather than treating standalone checks as integration evidence.

The migration performs a SQLite online backup before one write transaction.
Unknown legacy edits stop conversion. A durable initialization marker prevents
subsequent startup or migration from overwriting edited lessons or resurrecting
deletions. Restore the printed backup only while the application is stopped.

Native diagrams may include resolved connector crossings. Crossovers are
rendered explicitly; dense diagrams support native focus, node search, and the full
reader. Phone viewports contain the native viewport and retain readable lesson
text; they do not promise the same presentation controls as a desktop.
